import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, enabled } = body || {};
    if (!id || typeof enabled !== "boolean") {
      return NextResponse.json({ ok: false, error: "invalid payload" }, { status: 400 });
    }

    const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";
    if (!SUPA_URL || !SERVICE_KEY) {
      return NextResponse.json({ ok: false, error: "server not configured" }, { status: 500 });
    }

    const sb = createClient(SUPA_URL, SERVICE_KEY);

    // adjust table name/column if your project uses a different schema
    const { data, error } = await sb.from("modules").update({ enabled }).eq("id", id).select().single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, module: data });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}