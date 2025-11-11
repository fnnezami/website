import { NextResponse } from "next/server";
import { parseRange, supabaseAdmin } from "./_supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const { sinceSQL } = parseRange(url.searchParams.get("range"));
    const supabase = supabaseAdmin();

    const rpc = await supabase.rpc("analytics_summary", { p_since: sinceSQL });
    if (!rpc.error && rpc.data) {
      return NextResponse.json({ ok: true, data: rpc.data?.[0] || { views: 0, unique_clients: 0 } });
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

    const total = await supabase.from("analytics_events").select("*", { head: true, count: "exact" }).gte("ts", sinceISO);
    if (total.error) throw total.error;
    const uniq = await supabase
      .from("analytics_events")
      .select("client_id")
      .not("client_id", "is", null)
      .gte("ts", sinceISO)
      .range(0, 9999);
    if (uniq.error) throw uniq.error;

    return NextResponse.json({
      ok: true,
      data: { views: total.count || 0, unique_clients: new Set((uniq.data || []).map((r: any) => r.client_id)).size },
    });
  } catch (e: any) {
    const msg = e?.message || "summary failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}