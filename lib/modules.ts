import { createClient } from "@supabase/supabase-js";

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

export async function getPageModuleBySlug(slug: string, srv?: any) {
  if (!slug) return null;

  const normalize = (p?: any) => {
    if (!p && p !== 0) return "";
    const s = String(p);
    return s.replace(/^\/+|\/+$/g, "");
  };

  const param = normalize(slug);

  // 1) try DB/registry first
  const all = await loadManifestsWithRegistry(srv);
  for (const m of all) {
    const candidate = normalize(m.config?.pagePath || m.slug || m.id || "");
    if (!candidate) continue;
    // exact match or module path is a prefix for nested routes (e.g. candidate="blog" matches "blog" and "blog/..." )
    if (param === candidate || param === "" && candidate === "" || param.startsWith(candidate + "/")) {
      if (m.enabled !== false) return m;
    }
  }

  // 2) server-side disk fallback (keep for local modules on disk)
  if (typeof window === "undefined") {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const fs = require("fs");
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const path = require("path");

      const modulesDir = path.join(process.cwd(), "modules");
      if (fs.existsSync(modulesDir)) {
        for (const id of fs.readdirSync(modulesDir)) {
          try {
            const mpath = path.join(modulesDir, id, "manifest.json");
            if (!fs.existsSync(mpath)) continue;
            const raw = fs.readFileSync(mpath, "utf8");
            const mf = JSON.parse(raw);
            const candidate = normalize(mf.config?.pagePath || mf.slug || mf.id || id);
            if (!candidate) continue;
            if (param === candidate || param.startsWith(candidate + "/")) {
              return { ...mf, id: mf.id || id, enabled: mf.enabled !== false, _source: "disk" };
            }
          } catch {
            // ignore individual manifest errors
          }
        }
      }
    } catch {
      // noop
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
