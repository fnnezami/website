// app/api/admin/code/blocks/list/route.ts
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

const ALLOWED_EXT = new Set([".ts", ".tsx", ".js", ".jsx"]);

async function walk(dir: string, baseForReturn: string, out: string[]) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const ent of entries) {
    const abs = path.join(dir, ent.name);
    const rel = path.join(baseForReturn, ent.name);
    if (ent.isDirectory()) {
      await walk(abs, rel, out);
    } else {
      const ext = path.extname(ent.name).toLowerCase();
      if (ALLOWED_EXT.has(ext)) out.push("/" + rel.replace(/\\/g, "/"));
    }
  }
}

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return jerr("Block file browsing disabled in production.", 403);
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
  const allow: string[] = Array.isArray(settings?.admin_allowlist)
    ? settings!.admin_allowlist.map((e: string) => (e||"").toLowerCase())
    : [];
  if (!allow.includes(email)) return jerr("Forbidden", 403);

  const cwd = process.cwd();
  const modulesAbs = safeJoin(cwd, "modules");
  await fs.mkdir(modulesAbs, { recursive: true });

  const files: string[] = [];
  await walk(modulesAbs, "modules", files);

  // Sort nicely (folders/files by path)
  files.sort((a, b) => a.localeCompare(b));

  return NextResponse.json({ ok: true, files }, { headers: { "Cache-Control": "no-store" } });
}
