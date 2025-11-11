import { NextResponse } from "next/server";
import { supabaseAdmin } from "./_supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || "50"), 1), 200);
    const supabase = supabaseAdmin();

    const { data, error } = await supabase
      .from("analytics_events")
      .select("ts,path,entity_type,entity_id,referrer_host,ip_country,ip_region,ip_city,ip_company,ip_org,client_id")
      .order("ts", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return NextResponse.json({ ok: true, data: data || [] });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message || "recent failed" }, { status: 400 });
  }
}