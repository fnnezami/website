import { NextResponse } from "next/server";
import { parseRange, supabaseAdmin } from "./_supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const { sinceSQL } = parseRange(url.searchParams.get("range"));
    const entityType = url.searchParams.get("entityType");
    const entityId = url.searchParams.get("entityId");
    const limit = Number(url.searchParams.get("limit") || "20");
    const supabase = supabaseAdmin();

    const rpc = await supabase.rpc("analytics_top_paths", {
      p_since: sinceSQL,
      p_entity_type: entityType && entityType !== "all" ? entityType : null,
      p_entity_id: entityId || null,
      p_limit: Number.isFinite(limit) ? limit : 20,
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

    let q = supabase.from("analytics_events").select("path, entity_type, entity_id").gte("ts", sinceISO).range(0, 9999);
    if (entityType && entityType !== "all") q = q.eq("entity_type", entityType);
    if (entityId) q = q.eq("entity_id", entityId);
    const { data, error } = await q;
    if (error) throw error;

    const map = new Map<string, { path: string; entity_type: string | null; entity_id: string | null; views: number }>();
    for (const r of data || []) {
      const key = `${r.path}|${r.entity_type || ""}|${r.entity_id || ""}`;
      const cur = map.get(key) || { path: r.path, entity_type: r.entity_type, entity_id: r.entity_id, views: 0 };
      cur.views += 1;
      map.set(key, cur);
    }
    const rows = Array.from(map.values()).sort((a, b) => b.views - a.views).slice(0, Number.isFinite(limit) ? limit : 20);
    return NextResponse.json({ ok: true, data: rows });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message || "top failed" }, { status: 400 });
  }
}