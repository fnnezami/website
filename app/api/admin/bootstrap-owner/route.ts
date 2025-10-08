// app/api/admin/bootstrap-owner/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jerr(message: string, status = 500) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST() {
  try {
    const SUPA_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const SUPA_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    const SERVICE   = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

    if (!SUPA_URL || !SUPA_ANON) return jerr("Supabase env missing.");
    if (!SERVICE) return jerr("SUPABASE_SERVICE_ROLE_KEY missing.");

    // 1) Who is calling? (server-verified)
    const jar = await cookies();
    const anon = createServerClient(SUPA_URL, SUPA_ANON, {
      cookies: {
        get: (n: string) => jar.get(n)?.value,
        set() {},
        remove() {},
      },
    });

    const { data: { user }, error: authErr } = await anon.auth.getUser();
    if (authErr) return jerr(`Auth error: ${authErr.message}`, 401);
    if (!user?.email) return jerr("Not authenticated.", 401);

    const email = user.email.toLowerCase();

    // 2) Read allowlist via service role (RLS bypass)
    const srv = createClient(SUPA_URL, SERVICE);
    const { data: settings, error: readErr } = await srv
      .from("settings")
      .select("id, admin_allowlist")
      .eq("id", 1)
      .maybeSingle();

    if (readErr) return jerr(`settings read: ${readErr.message}`);
    if (!settings) return jerr("settings row not found (id=1). Run provision first.");

    const current = Array.isArray(settings.admin_allowlist)
      ? (settings.admin_allowlist as string[]).map((e) => (e || "").toLowerCase())
      : [];

    if (current.length > 0) {
      // Already bootstrapped — return current
      return NextResponse.json({
        ok: true,
        bootstrapped: false,
        admin_allowlist: current,
      });
    }

    // 3) Bootstrap: set the allowlist to the caller's email (first owner)
    const { error: upErr } = await srv
      .from("settings")
      .update({ admin_allowlist: [email] })
      .eq("id", 1);

    if (upErr) return jerr(`settings update: ${upErr.message}`);

    return NextResponse.json({
      ok: true,
      bootstrapped: true,
      admin_allowlist: [email],
    });
  } catch (e: any) {
    return jerr(String(e?.message || e), 500);
  }
}
