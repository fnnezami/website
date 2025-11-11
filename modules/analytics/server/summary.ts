import { NextResponse } from "next/server";
import { parseRange, supabaseAdmin } from "./_supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const { sinceSQL } = parseRange(url.searchParams.get("range"));
    const supabase = supabaseAdmin();

    // Try RPC first
    const rpc = await supabase.rpc("analytics_summary", { p_since: sinceSQL });
    if (!rpc.error && rpc.data) {
      return NextResponse.json({ ok: true, data: rpc.data?.[0] || { views: 0, unique_clients: 0 } });
    }

    // Fallback: aggregate in JS
    const since = (() => {
      const now = new Date();
      if (sinceSQL.includes("1 day")) return new Date(now.getTime() - 24 * 3600e3);
      if (sinceSQL.includes("30 days")) return new Date(now.getTime() - 30 * 24 * 3600e3);
      if (sinceSQL.includes("90 days")) return new Date(now.getTime() - 90 * 24 * 3600e3);
      return new Date(now.getTime() - 7 * 24 * 3600e3);
    })();
    const sinceISO = since.toISOString();

    // Total views
    const total = await supabase
      .from("analytics_events")
      .select("*", { head: true, count: "exact" })
      .gte("ts", sinceISO);
    const views = total.count || 0;

    // Unique clients (fetch up to 10k rows; tune if needed)
    const uniq = await supabase
      .from("analytics_events")
      .select("client_id")
      .not("client_id", "is", null)
      .gte("ts", sinceISO)
      .range(0, 9999);
    const unique_clients = new Set((uniq.data || []).map((r: any) => r.client_id)).size;

    return NextResponse.json({ ok: true, data: { views, unique_clients } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message || "summary failed" }, { status: 400 });
  }
}