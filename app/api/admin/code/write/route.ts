// app/api/admin/code/write/route.ts
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

// Helper to ensure we only write inside the project folder
function safeJoin(base: string, ...parts: string[]) {
  const target = path.resolve(base, ...parts);
  if (!target.startsWith(path.resolve(base))) {
    throw new Error("Path traversal attempt.");
  }
  return target;
}

export async function POST(req: Request) {
  // Deny in production by default (you can relax if you run a writable VM)
  if (process.env.NODE_ENV === "production") {
    return jerr("Code writer is disabled in production.", 403);
  }

  const SUPA_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const SUPA_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const SERVICE   = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!SUPA_URL || !SUPA_ANON || !SERVICE) {
    return jerr("Supabase is not fully configured.");
  }

  // 1) Verify admin identity
  const jar = await cookies();
  const anon = createServerClient(SUPA_URL, SUPA_ANON, {
    cookies: { get: (n) => jar.get(n)?.value, set(){}, remove(){} },
  });
  const { data: { user } } = await anon.auth.getUser();
  const email = user?.email?.toLowerCase() || "";
  if (!email) return jerr("Unauthenticated.", 401);

  const srv = createClient(SUPA_URL, SERVICE);
  const { data: settings, error: sErr } = await srv
    .from("settings")
    .select("admin_allowlist")
    .eq("id", 1)
    .maybeSingle();
  if (sErr) return jerr(`Settings read failed: ${sErr.message}`, 500);

  const allow: string[] = Array.isArray(settings?.admin_allowlist)
    ? settings!.admin_allowlist.map((e: string) => (e || "").toLowerCase())
    : [];
  if (!allow.includes(email)) return jerr("Forbidden (admin only).", 403);

  // 2) Parse payload
  let body: any = {};
  try { body = await req.json(); } catch { return jerr("Invalid JSON body."); }

  const rawName = String(body?.name || "").trim();
  const code    = String(body?.code || "");
  const updateRegistry: boolean = !!body?.updateRegistry;

  if (!rawName) return jerr("Block name is required (e.g., MyWidget).");
  if (!/^[A-Z][A-Za-z0-9_]*$/.test(rawName)) {
    return jerr("Block name must start with a capital letter and contain only letters/numbers/underscore.");
  }
  if (!code.trim()) return jerr("Code is empty.");

  // 3) Write /modules/<Name>.tsx
  const cwd = process.cwd();
  const modulesDir = safeJoin(cwd, "modules");
  await fs.mkdir(modulesDir, { recursive: true });

  const filePath = safeJoin(modulesDir, `${rawName}.tsx`);

  // Avoid overwriting unless explicitly allowed
  if (await fs.stat(filePath).catch(() => null)) {
    // allow overwrite; you can enforce no-overwrite if you prefer
  }
  await fs.writeFile(filePath, code, "utf8");

  // 4) Optionally update /lib/blocks/registry.ts between markers
  if (updateRegistry) {
    const regPath = safeJoin(cwd, "lib", "blocks", "registry.ts");
    const markerStart = "// AUTO-REGISTRY-START";
    const markerEnd   = "// AUTO-REGISTRY-END";

    const reg = await fs.readFile(regPath, "utf8");
    if (!reg || !reg.includes(markerStart) || !reg.includes(markerEnd)) {
      return NextResponse.json({
        ok: true,
        note: "File written. Registry NOT auto-updated (markers missing). Please add the import and registry entry manually."
      });
    }

    // Insert import and mapping inside the markers if not present
    const importLine = `  ${rawName}: dynamic(() => import("@/modules/${rawName}")),`;
    const typeLine   = `  | "${rawName}"`;
    const hasType    = reg.includes(`"${rawName}"`);
    const hasImport  = reg.includes(`import("@/modules/${rawName}")`);

    const [before, rest] = reg.split(markerStart);
    const [between, after] = rest.split(markerEnd);

    let newBetween = between;

    // add to BlockType union
    if (!hasType) {
      newBetween = newBetween.replace(
        /export type BlockType =([\s\S]*?);/,
        (m, group) => `export type BlockType =${group}\n${typeLine};`
      );
    }

    // add import mapping
    if (!hasImport) {
      newBetween = newBetween.replace(
        /export const BlockRegistry:[\s\S]*?=\s*{([\s\S]*?)}/,
        (m, group) => {
          const hasTrailing = group.trim().endsWith(",");
          const g = hasTrailing ? group : group + ",";
          return `export const BlockRegistry: Record<BlockType, React.ComponentType<any>> = {\n${g}\n${importLine}\n}`;
        }
      );
    }

    const updated = `${before}${markerStart}${newBetween}${markerEnd}${after}`;
    await fs.writeFile(regPath, updated, "utf8");
  }

  return NextResponse.json({ ok: true, file: `/modules/${rawName}.tsx` }, { headers: { "Cache-Control": "no-store" } });
}
