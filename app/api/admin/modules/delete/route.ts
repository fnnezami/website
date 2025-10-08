// app/api/admin/modules/delete/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jerr(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

export async function POST(req: Request) {
  const SUPA_URL   = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const SUPA_ANON  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const SERVICE    = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!SUPA_URL || !SUPA_ANON || !SERVICE) {
    return jerr("Supabase is not fully configured on the server.", 500);
  }

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

  const srv = createClient(SUPA_URL, SERVICE);
  const { data: settings } = await srv
    .from("settings")
    .select("admin_allowlist")
    .eq("id", 1)
    .maybeSingle();

  const allow: string[] = Array.isArray(settings?.admin_allowlist)
    ? settings!.admin_allowlist.map((e: string) => (e || "").toLowerCase())
    : [];
  if (!allow.includes(email)) return jerr("Forbidden (admin only).", 403);

  let payload: any = {};
  try { payload = await req.json(); } catch { return jerr("Invalid JSON body."); }
  const id = String(payload?.id || "").trim();
  if (!id) return jerr("Missing id.");

  const { error } = await srv.from("modules").delete().eq("id", id);
  if (error) return jerr(`Delete failed: ${error.message}`, 400);

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
