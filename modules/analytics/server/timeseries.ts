import { NextResponse } from "next/server";
import { parseRange, supabaseAdmin } from "./_supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const { sinceSQL, bucket } = parseRange(url.searchParams.get("range"));
    const bucketParam = (url.searchParams.get("bucket") || bucket) as "hour" | "day";
    const entityType = url.searchParams.get("entityType");
    const entityId = url.searchParams.get("entityId");
    const supabase = supabaseAdmin();

    const rpc = await supabase.rpc("analytics_timeseries", {
      p_since: sinceSQL,
      p_bucket: bucketParam,
      p_entity_type: entityType && entityType !== "all" ? entityType : null,
      p_entity_id: entityId || null,
    });
    if (!rpc.error && rpc.data) {
      return NextResponse.json({ ok: true, data: rpc.data || [] });
    }

    const now = new Date();
    const since =
      sinceSQL === "1 day"
        ? new Date(now.getTime() - 24 * 3600e3)
        : sinceSQL === "30 days"
        ? new Date(now.getTime() - 30 * 24 * 3600e3)
        : sinceSQL === "90 days"
        ? new Date(now.getTime() - 90 * 24 * 3600e3)
        : new Date(now.getTime() - 7 * 24 * 3600e3);
    const sinceISO = since.toISOString();

    let q = supabase.from("analytics_events").select("ts").gte("ts", sinceISO).lt("ts", now.toISOString()).range(0, 9999);
    if (entityType && entityType !== "all") q = q.eq("entity_type", entityType);
    if (entityId) q = q.eq("entity_id", entityId);
    const { data, error } = await q;
    if (error) throw error;

    const buckets = new Map<string, number>();
    for (const r of data || []) {
      const d = new Date(r.ts);
      const key =
        bucketParam === "hour"
          ? new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), 0, 0, 0)).toISOString()
          : new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0)).toISOString();
      buckets.set(key, (buckets.get(key) || 0) + 1);
    }

    const result = Array.from(buckets.entries())
      .map(([bucket_ts, views]) => ({ bucket_ts, views }))
      .sort((a, b) => new Date(a.bucket_ts).getTime() - new Date(b.bucket_ts).getTime());

    return NextResponse.json({ ok: true, data: result });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message || "timeseries failed" }, { status: 400 });
  }
}