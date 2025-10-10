import { createClient } from "@supabase/supabase-js";
import fs from "fs/promises";
import path from "path";

export async function loadManifestsWithRegistry(
  srv?: any,
  opts?: { includeDisabled?: boolean }
) {
  const includeDisabled = !!opts?.includeDisabled;

  // Client-side: proxy to server API (keeps browser bundle clean)
  if (typeof window !== "undefined") {
    const q = includeDisabled ? "?includeDisabled=1" : "";
    const res = await fetch(`/api/modules/registry${q}`, { cache: "no-store" });
    if (!res.ok) return [];
    try {
      return (await res.json()) || [];
    } catch {
      return [];
    }
  }

  // Server-side: read modules from DB only (no fs)
  try {
    // require here to avoid bundling server-only code into client build
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createClient } = require("@supabase/supabase-js");

    const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const SERVICE_KEY =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";

    const client = srv || (SUPA_URL && SERVICE_KEY ? createClient(SUPA_URL, SERVICE_KEY) : null);
    if (!client) return [];

    const { data, error } = await client.from("modules").select("*");
    if (error || !Array.isArray(data)) return [];

    const list = data;
    if (includeDisabled) return list;
    return list.filter((m: any) => m.enabled !== false);
  } catch {
    return [];
  }
}

// server helpers
export async function getEnabledFloatingModules(srv?: any) {
  const all = await loadManifestsWithRegistry(srv);
  return all.filter((m: any) => m.kind === "floating" && m.enabled !== false);
}

export async function getPageModuleBySlug(slug: string) {
  const modules = await listInstalledModules(); // existing loader
  for (const m of modules) {
    const rawPagePath = m.config?.pagePath || "";
    const normalizedPagePath = rawPagePath.replace(/^\/+|\/+$/g, ""); // trim slashes
    // candidate that used to be used (keep for backwards compatibility)
    const candidate = normalizedPagePath || m.slug || m.id;

    if (candidate === slug) return m;

    // Minimal additions: also accept module id, module slug explicitly,
    // and the basename of a configured pagePath (e.g. "/modules/blog-posts/public" -> "blog-posts")
    if (m.id === slug) return m;
    if (m.slug && m.slug === slug) return m;

    if (normalizedPagePath) {
      const base = path.posix.basename(normalizedPagePath);
      if (base === slug) return m;
    }
  }
  return null;
}

export async function loadModuleManifest(id: string, srv?: any) {
  if (!id) return null;
  // try registry / DB first (includeDisabled so not-yet-enabled modules are found)
  try {
    const all = await loadManifestsWithRegistry(srv as any, { includeDisabled: true });
    const found = (all || []).find((m: any) => String(m.id) === String(id) || String(m.name) === String(id));
    if (found) return found;
  } catch {
    // ignore
  }

  // server-side fallback: try reading modules/<id>/manifest.json
  if (typeof window === "undefined") {
    try {
      // require here to avoid bundling server-only code
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const fs = require("fs");
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const path = require("path");

      const mpath = path.join(process.cwd(), "modules", String(id), "manifest.json");
      if (fs.existsSync(mpath)) {
        const raw = fs.readFileSync(mpath, "utf8");
        const mf = JSON.parse(raw);
        return { ...mf, id: mf.id || id, enabled: mf.enabled !== false, _source: "disk" };
      }
    } catch {
      // ignore
    }
  }

  return null;
}

// Minimal runtime listInstalledModules used by getPageModuleBySlug and other lookups.
// Returns an array of modules with { id, slug, config, manifest }.
export async function listInstalledModules() {
  const modulesRoot = path.join(process.cwd(), "modules");
  try {
    const dirents = await fs.readdir(modulesRoot, { withFileTypes: true });
    const dirs = dirents.filter(d => d.isDirectory()).map(d => d.name);
    const result: Array<{ id: string; slug?: string; config?: any; manifest?: any }> = [];
    for (const id of dirs) {
      const manifestPath = path.join(modulesRoot, id, "manifest.json");
      try {
        const content = await fs.readFile(manifestPath, "utf8");
        const manifest = JSON.parse(content);
        result.push({
          id,
          slug: manifest.slug || id,
          config: manifest.config || {},
          manifest,
        });
      } catch (err) {
        // skip entries without a valid manifest
        continue;
      }
    }
    return result;
  } catch (err) {
    return [];
  }
}
