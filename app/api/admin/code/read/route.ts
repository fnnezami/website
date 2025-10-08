import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jerr(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}
function safeJoin(base: string, ...parts: string[]) {
  const t = path.resolve(base, ...parts);
  if (!t.startsWith(path.resolve(base))) throw new Error("Path traversal");
  return t;
}

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return jerr("Code read disabled in production.", 403);
  }

  const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const SUPA_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!SUPA_URL || !SUPA_ANON || !SERVICE) return jerr("Supabase not configured", 500);

  const jar = await cookies();
  const anon = createServerClient(SUPA_URL, SUPA_ANON, {
    cookies: { get: (n) => jar.get(n)?.value, set() {}, remove() {} },
  });
  const { data: { user } } = await anon.auth.getUser();
  const email = user?.email?.toLowerCase();
  if (!email) return jerr("Unauthenticated", 401);

  const srv = createClient(SUPA_URL, SERVICE);
  const { data: settings } = await srv.from("settings").select("admin_allowlist").eq("id", 1).maybeSingle();
  const allow: string[] = Array.isArray(settings?.admin_allowlist) ? settings!.admin_allowlist.map((e: string) => (e||"").toLowerCase()) : [];
  if (!allow.includes(email)) return jerr("Forbidden", 403);

  let body: any = {};
  try { body = await req.json(); } catch { return jerr("Invalid JSON"); }
  const file = String(body?.file || "");
  if (!file.startsWith("/modules/")) return jerr("Only /modules/* allowed.");
  if (!/\.tsx?$/i.test(file)) return jerr("Only TS/TSX files allowed.");

  const cwd = process.cwd();
  const fp = safeJoin(cwd, file.slice(1));
  const code = await fs.readFile(fp, "utf8").catch(() => null);
  if (code == null) return jerr("Not found", 404);

  return NextResponse.json({ ok: true, code }, { headers: { "Cache-Control": "no-store" } });
}
