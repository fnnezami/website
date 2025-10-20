import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";
import path from "path";
import fs from "fs";
import { loadModuleManifest } from "@/lib/modules";

export const runtime = "nodejs";

async function getPgClient() {
  const conn = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (!conn) throw new Error("Missing SUPABASE_DB_URL / DATABASE_URL env");
  const client = new Client({ connectionString: conn });
  await client.connect();
  return client;
}

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

// keep your existing verifyAdmin implementation (unchanged)
async function verifyAdmin(req: Request) {
  const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const SUPA_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!SUPA_URL || !SUPA_ANON || !SERVICE) throw new Error("Supabase envs not configured");

  const cookieHeader = req.headers.get("cookie") || "";
  const cookies = parseCookies(cookieHeader);
  const server = createServerClient(SUPA_URL, SUPA_ANON, {
    cookies: {
      get: (n: string) => cookies[n],
      set: () => {},
      remove: () => {},
    },
  });

  const { data: { user } } = await server.auth.getUser();
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

  if (allow.length === 0) {
    return true;
  }

  return allow.includes(email);
}

function chooseInstallerName(manifest: any) {
  // manifest.installer or common default names
  if (manifest?.installer) return manifest.installer;
  for (const candidate of ["install.js", "install.ts", "install.tsx", "install.mjs"]) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return "install.js";
}

export async function POST(req: Request) {
  try {
    const ok = await verifyAdmin(req);
    if (!ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const body = await req.json();
    const moduleId = body?.moduleId;
    if (!moduleId) return NextResponse.json({ error: "missing moduleId" }, { status: 400 });

    const manifest = await loadModuleManifest(moduleId);
    if (!manifest) return NextResponse.json({ error: "module not found" }, { status: 404 });

    const client = await getPgClient();
    try {
      // ensure registry tables exist
      await client.query(`
        CREATE TABLE IF NOT EXISTS public.modules (
          id TEXT PRIMARY KEY,
          kind TEXT,
          title TEXT,
          enabled BOOLEAN DEFAULT false,
          config JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
        );
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS public.modules_migrations (
          id SERIAL PRIMARY KEY,
          module_id TEXT NOT NULL,
          migration TEXT NOT NULL,
          success BOOLEAN,
          applied_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
          error TEXT
        );
      `);

      // upsert module record
      await client.query(
        `INSERT INTO public.modules (id, kind, title, enabled, config, updated_at)
         VALUES ($1, $2, $3, true, $4::jsonb, now())
         ON CONFLICT (id) DO UPDATE SET kind = EXCLUDED.kind, title = EXCLUDED.title, enabled = EXCLUDED.enabled, config = EXCLUDED.config, updated_at = now()`,
        [manifest.id, (manifest as any).kind || "floating", manifest.name || null, JSON.stringify(manifest.config || {})]
      );

      // === RUN MODULE INSTALLER SCRIPT (MANDATORY) ===
      // Always attempt to run the module's installer script after registry upsert.
      const moduleDir = path.join(process.cwd(), "modules", manifest.id);
      let installerName = (manifest && (manifest.installer || manifest.installerFile)) || "install.js";
      const installerPath = path.join(moduleDir, installerName);
      const installerResult: any = { ran: false };

      if (!fs.existsSync(installerPath)) {
        // fallback: common alternatives
        const alts = ["install.js", "install.mjs", "install.ts", "install.tsx"];
        for (const a of alts) {
          const p = path.join(moduleDir, a);
          if (fs.existsSync(p)) {
            installerName = a;
            break;
          }
        }
      }

      const finalInstallerPath = path.join(moduleDir, installerName);
      if (fs.existsSync(finalInstallerPath)) {
        installerResult.ran = true;
        try {
          // spawn a separate Node process to execute the module installer
          // supports .ts/.tsx via -r ts-node/register if available
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const { spawnSync } = require("child_process");
          const ext = path.extname(finalInstallerPath).toLowerCase();
          let args: string[] = [];

          if (ext === ".ts" || ext === ".tsx") {
            try {
              // ensure ts-node/register is resolvable
              // eslint-disable-next-line @typescript-eslint/no-var-requires
              require.resolve("ts-node/register");
              args = ["-r", "ts-node/register", finalInstallerPath];
            } catch (e) {
              throw new Error("TypeScript installer detected but ts-node not installed. Install ts-node + typescript or use a JS installer.");
            }
          } else {
            args = [finalInstallerPath];
          }

          const proc = spawnSync(process.execPath, args, {
            cwd: moduleDir,
            env: Object.assign({}, process.env),
            encoding: "utf8",
            timeout: 5 * 60 * 1000,
            maxBuffer: 20 * 1024 * 1024,
          });

          installerResult.proc = {
            status: proc.status,
            stdout: proc.stdout ? String(proc.stdout).slice(0, 200000) : "",
            stderr: proc.stderr ? String(proc.stderr).slice(0, 200000) : "",
          };

          // surface installer output in the API response and server logs
          // eslint-disable-next-line no-console
          console.log("[module-installer]", manifest.id, "status=", installerResult.proc.status);
          // eslint-disable-next-line no-console
          console.log("[module-installer] stdout:", installerResult.proc.stdout);
          // eslint-disable-next-line no-console
          console.error("[module-installer] stderr:", installerResult.proc.stderr);

          if (proc.status !== 0) {
            throw new Error(`installer exited with status ${proc.status}. stderr: ${installerResult.proc.stderr}`);
          }
        } catch (err: any) {
          await client.query("ROLLBACK").catch(() => {});
          return NextResponse.json({ error: String(err?.message || err), installer: installerResult }, { status: 500 });
        }
      } else {
        // No installer found — treat as no-op but explicitly note it
        installerResult.ran = false;
      }
      // === END RUN INSTALLER ===

      await client.query("COMMIT");
      return NextResponse.json({ ok: true, installer: installerResult });
    } catch (err: any) {
      await client.query("ROLLBACK").catch(() => {});
      return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
    } finally {
      await client.end().catch(() => {});
    }
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}