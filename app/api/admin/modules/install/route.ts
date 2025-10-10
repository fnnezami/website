import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";
import path from "path";
import fs from "fs";
import { loadModuleManifest, readModuleMigrationSQL } from "@/lib/modules";

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

      // upsert the registry row first (so module appears in admin immediately)
      await client.query(
        `INSERT INTO public.modules (id, kind, title, enabled, config, updated_at)
         VALUES ($1, $2, $3, true, $4::jsonb, now())
         ON CONFLICT (id) DO UPDATE SET kind = EXCLUDED.kind, title = EXCLUDED.title, enabled = EXCLUDED.enabled, config = EXCLUDED.config, updated_at = now()`,
        [manifest.id, (manifest as any).kind || "floating", manifest.name || null, JSON.stringify(manifest.config || {})]
      );

      // Now run the module's installer script if present
      const moduleDir = path.join(process.cwd(), "modules", moduleId);
      const installerName = manifest.installer || "install.js";
      const installerPath = path.join(moduleDir, installerName);

      const installerResult: any = { ran: false };

      if (fs.existsSync(installerPath)) {
        installerResult.ran = true;
        // support .ts/.tsx by registering ts-node at runtime if available
        if (installerPath.endsWith(".ts") || installerPath.endsWith(".tsx")) {
          try {
            // avoid static require analysis by webpack/bundler
            // eslint-disable-next-line no-eval
            const req = eval("require");
            const tsnode = req("ts-node");
            if (tsnode && typeof tsnode.register === "function") tsnode.register({ transpileOnly: true });
          } catch (e) {
            throw new Error("ts-node not available. install ts-node and typescript to run .ts installers: npm install ts-node typescript");
          }
        }

        // Load installer module without letting bundler analyze dynamic require.
        let mod: any = null;
        try {
          // eslint-disable-next-line no-eval
          const req = eval("require");
          mod = req(installerPath);
        } catch (reqErr) {
          // fallback to dynamic ESM import (convert path to file URL)
          try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { pathToFileURL } = require("url");
            const imp = await import(pathToFileURL(installerPath).href);
            mod = imp;
          } catch (impErr) {
            throw new Error("failed to load installer module: " + String(reqErr?.message || reqErr) + " / " + String(impErr?.message || impErr));
          }
        }

        const fn = mod?.default || mod?.install || mod?.run || mod;
        if (typeof fn !== "function") {
          throw new Error("installer did not export a function (default / install / run)");
        }

        // provide context to installer
        const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
        const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";
        const supabaseService = SUPA_URL && SERVICE_KEY ? createClient(SUPA_URL, SERVICE_KEY) : null;

        // pass a PG client instance for installer usage
        const pgForInstaller = await getPgClient();

        try {
          const out = await fn({
            moduleDir,
            manifest,
            pgClient: pgForInstaller,
            supabaseService,
          });
          installerResult.output = out;
        } catch (err: any) {
          installerResult.error = String(err?.message || err);
          throw new Error("installer failed: " + installerResult.error);
        } finally {
          await pgForInstaller.end().catch(() => {});
        }
      }

      return NextResponse.json({ ok: true, installer: installerResult });
    } catch (err: any) {
      return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
    } finally {
      await client.end().catch(() => {});
    }
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}