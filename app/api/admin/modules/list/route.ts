// app/api/admin/modules/list/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jerr(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

export async function GET() {
  const SUPA_URL   = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const SUPA_ANON  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const SERVICE    = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!SUPA_URL || !SUPA_ANON || !SERVICE) {
    return jerr("Supabase is not fully configured on the server.", 500);
  }

  // Identify caller
  const jar = await cookies();
  const anon = createServerClient(SUPA_URL, SUPA_ANON, {
    cookies: {
      get: (n: string) => jar.get(n)?.value,
      set() {},
      remove() {},
    },
  });

  const { data: { user } } = await anon.auth.getUser();
  const email = user?.email?.toLowerCase() || "";
  if (!email) return jerr("Unauthenticated.", 401);

  // Check allowlist via service client
  const srv = createClient(SUPA_URL, SERVICE);
  const { data: settings, error: setErr } = await srv
    .from("settings")
    .select("admin_allowlist")
    .eq("id", 1)
    .maybeSingle();
  if (setErr) return jerr(`Settings read failed: ${setErr.message}`, 500);

  const allow: string[] = Array.isArray(settings?.admin_allowlist)
    ? settings!.admin_allowlist.map((e: string) => (e || "").toLowerCase())
    : [];

  if (!allow.includes(email)) return jerr("Forbidden (admin only).", 403);

  // Read all modules (service client bypasses RLS)
  const { data, error } = await srv
    .from("modules")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) return jerr(`Modules read failed: ${error.message}`, 500);

  return NextResponse.json({ ok: true, modules: data }, { headers: { "Cache-Control": "no-store" } });
}
