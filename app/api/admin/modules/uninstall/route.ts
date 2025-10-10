import { NextResponse } from "next/server";

export const runtime = "nodejs";

function parseCookies(cookieHeader: string | null) {
  const map: Record<string, string> = {};
  if (!cookieHeader) return map;
  for (const part of cookieHeader.split(";")) {
    const [k, ...rest] = part.split("=");
    if (!k) continue;
    map[k.trim()] = decodeURIComponent((rest || []).join("=").trim());
  }
  return map;
}

async function verifyAdmin(req: Request) {
  const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const SUPA_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!SUPA_URL || !SUPA_ANON || !SERVICE) throw new Error("Supabase envs not configured");

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createServerClient } = require("@supabase/ssr");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createClient } = require("@supabase/supabase-js");

  const cookieHeader = req.headers.get("cookie") || "";
  const cookies = parseCookies(cookieHeader);
  const server = createServerClient(SUPA_URL, SUPA_ANON, {
    cookies: {
      get: (n: string) => cookies[n],
      set: () => {},
      remove: () => {},
    },
  });

  const {
    data: { user },
  } = await server.auth.getUser();
  const email = user?.email?.toLowerCase() || null;
  if (!email) throw new Error("Not authenticated");

  const srv = createClient(SUPA_URL, SERVICE);
  const { data: settings, error } = await srv
    .from("settings")
    .select("admin_allowlist")
    .eq("id", 1)
    .maybeSingle();

  if (error) throw error;
  const allow: string[] = Array.isArray(settings?.admin_allowlist)
    ? settings!.admin_allowlist.map((e: string) => (e || "").toLowerCase())
    : [];

  if (allow.length === 0) return true;
  return allow.includes(email);
}

export async function POST(req: Request) {
  try {
    const ok = await verifyAdmin(req);
    if (!ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const moduleId = body?.moduleId;
    if (!moduleId) return NextResponse.json({ error: "missing moduleId" }, { status: 400 });

    // server-only requires
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require("fs");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = require("path");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { spawnSync } = require("child_process");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createClient } = require("@supabase/supabase-js");

    // sanitize moduleId
    const id = String(moduleId).replace(/[^a-zA-Z0-9_\-]/g, "-");
    const modulesDir = path.join(process.cwd(), "modules");
    const modDir = path.join(modulesDir, id);

    if (!fs.existsSync(modDir) || !fs.statSync(modDir).isDirectory()) {
      return NextResponse.json({ error: "module folder not found" }, { status: 404 });
    }

    // find uninstall script
    const candidates = ["uninstall.js", "uninstall.mjs", "uninstall.ts", "uninstall.tsx"];
    let uninstallPath: string | null = null;
    for (const c of candidates) {
      const p = path.join(modDir, c);
      if (fs.existsSync(p) && fs.statSync(p).isFile()) {
        uninstallPath = p;
        break;
      }
    }

    if (!uninstallPath) {
      return NextResponse.json({ error: "uninstall script not found (required): " + candidates.join(", ") }, { status: 400 });
    }

    // run uninstall script in a separate Node process
    const ext = path.extname(uninstallPath).toLowerCase();
    let args: string[] = [];
    if (ext === ".ts" || ext === ".tsx") {
      // try to require ts-node/register via spawn -r
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require.resolve("ts-node/register");
        args = ["-r", "ts-node/register", uninstallPath];
      } catch (e) {
        return NextResponse.json(
          { error: "TypeScript uninstall detected but ts-node not installed. Install ts-node + typescript or provide JS uninstall." },
          { status: 400 }
        );
      }
    } else {
      args = [uninstallPath];
    }

    const proc = spawnSync(process.execPath, args, {
      cwd: modDir,
      env: process.env,
      encoding: "utf8",
      timeout: 5 * 60 * 1000,
    });

    const procResult = { status: proc.status, stdout: proc.stdout, stderr: proc.stderr };

    if (proc.status !== 0) {
      return NextResponse.json({ error: "uninstall script failed", proc: procResult }, { status: 500 });
    }

    // uninstall script succeeded -> remove module folder
    try {
      fs.rmSync(modDir, { recursive: true, force: true });
    } catch (e: any) {
      return NextResponse.json({ error: "failed to remove module folder: " + String(e?.message || e), proc: procResult }, { status: 500 });
    }

    // remove DB row from modules table via Supabase service key (if configured)
    const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";

    let dbResult: any = null;
    if (SUPA_URL && SERVICE_KEY) {
      try {
        const sb = createClient(SUPA_URL, SERVICE_KEY);
        const { error } = await sb.from("modules").delete().eq("id", id);
        if (error) {
          dbResult = { error: String(error?.message || error) };
        } else {
          dbResult = { ok: true };
        }
      } catch (e: any) {
        dbResult = { error: String(e?.message || e) };
      }
    } else {
      dbResult = { note: "supabase not configured; skipped modules table deletion" };
    }

    return NextResponse.json({ ok: true, proc: procResult, db: dbResult });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}