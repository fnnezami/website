// /components/Navbar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

const supabaseBrowser = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
const baseItems = [
  { label: "Resume", href: "/" },
  { label: "Publications", href: "/publications" },
  { label: "Projects", href: "/projects" },
];

export default function Navbar(props: { pageModules?: Array<any> }) {
  const pageModulesProp = props.pageModules || [];
  const pathname = usePathname();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const r = await fetch("/api/auth/state", { cache: "no-store" });
        const j = await r.json().catch(() => ({}));
        if (!mounted) return;
        setAuthed(!!j.authed);
        setEmail(j.email ?? null);
      } catch {
        if (mounted) { setAuthed(false); setEmail(null); }
      }
    })();

    // keep existing supabase auth subscription if available in runtime
    const { data: sub } = (typeof supabaseBrowser !== "undefined" && supabaseBrowser?.auth)
      ? supabaseBrowser.auth.onAuthStateChange((_evt: any, session: any) => {
          setAuthed(!!session);
          setEmail(session?.user?.email ?? null);
        })
      : { data: null };

    return () => { mounted = false; sub?.subscription?.unsubscribe?.(); };
  }, []);

  const normalize = (p: string) => (p.startsWith("/") ? p : `/${p}`);

  // merged nav items (base + page modules discovered from DB + fallback props)
  const [mergedItems, setMergedItems] = useState(() => [
    ...baseItems,
    // seed with any modules passed in via props (will be replaced by DB-driven list when loaded)
    ...pageModulesProp.map((m) => {
      const rawPagePath =
        typeof (m?.config ?? m?.manifest?.config)?.pagePath === "string" &&
        (m?.config ?? m?.manifest?.config).pagePath.trim() !== ""
          ? (m?.config ?? m?.manifest?.config).pagePath
          : null;
      const href = rawPagePath ? normalize(rawPagePath) : `/m/${m.id || m.name}`;
      return { label: m.name || m.id, href, moduleId: m.id, moduleName: m.name };
    }),
  ]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      // Try to read modules from the database first (kind = "page" and enabled = true).
      // If DB read fails, fall back to the pageModulesProp provided by the caller.
      let modulesFromDb: Array<any> = [];
      try {
        if (typeof supabaseBrowser !== "undefined" && supabaseBrowser.from) {
          const q = await supabaseBrowser
            .from("modules")
            .select("id,name,config,manifest_path,enabled,kind")
            .eq("kind", "page")
            .eq("enabled", true);
          if (!mounted) return;
          if (q.error) throw q.error;
          modulesFromDb = q.data ?? [];
        }
      } catch {
        // DB query failed; we'll use pageModulesProp as a fallback below
        modulesFromDb = [];
      }

      const sourceModules = modulesFromDb.length ? modulesFromDb : pageModulesProp;

      const items: Array<any> = [];

      for (const m of sourceModules) {
        if (!mounted) break;

        const id = m.id || m.moduleId || null;
        const name = m.name || m.moduleName || null;

        // try to read manifest from module folder(s)
        // Try manifest from DB-provided manifest_path, then from the module public API,
        // then fall back to a static /modules/<id>/manifest.json path.
        const manifestPaths: string[] = [];
        if (m?.manifest_path && typeof m.manifest_path === "string") manifestPaths.push(m.manifest_path);
        // IMPORTANT: client cannot read repo fs directly — use the server API that can read FS.
        if (id) manifestPaths.push(`/api/modules/public?module=${encodeURIComponent(id)}&file=manifest.json`);
        if (name) manifestPaths.push(`/api/modules/public?module=${encodeURIComponent(name)}&file=manifest.json`);
        // last-resort static URL (may 404 in dev if not served as static)
        if (id) manifestPaths.push(`/modules/${id}/manifest.json`);
        if (name) manifestPaths.push(`/modules/${name}/manifest.json`);

        let manifest: any = null;
        for (const p of manifestPaths) {
          try {
            const res = await fetch(p, { cache: "no-store" });
            if (!mounted) break;
            if (!res.ok) continue;
            manifest = await res.json().catch(() => null);
            if (manifest) break;
          } catch {
            // ignore and try next
          }
        }

        // prefer pagePath from manifest (if found), then from module record config, else fallback to /m/<id>
        let pagePath: string | null = null;
        if (manifest?.config?.pagePath && typeof manifest.config.pagePath === "string" && manifest.config.pagePath.trim() !== "") {
          pagePath = manifest.config.pagePath;
        } else if (m?.config?.pagePath && typeof m.config.pagePath === "string" && m.config.pagePath.trim() !== "") {
          pagePath = m.config.pagePath;
        } else if (m?.manifest?.config?.pagePath && typeof m.manifest.config.pagePath === "string" && m.manifest.config.pagePath.trim() !== "") {
          pagePath = m.manifest.config.pagePath;
        }

        // Resolve final href:
        // If the manifest points at a module's on-disk folder (modules/... or .../public),
        // map that to the universal module route /m/<id>. Otherwise, prefer the configured pagePath
        // if it appears to be a real public URL.
        let href: string;
        if (pagePath) {
          const candidate = normalize(pagePath);
          const looksLikeModuleFsPath = /(^\/?modules\/)|\/public(\/|$)/i.test(candidate);
          if (looksLikeModuleFsPath) {
            href = id ? `/m/${id}` : name ? `/m/${name}` : "/";
          } else {
            // keep candidate when it appears to be a valid public route
            href = candidate;
          }
        } else {
          href = id ? `/m/${id}` : name ? `/m/${name}` : "/";
        }

        const label = (manifest?.name) || m.name || m.title || id || name || "Module";

        items.push({ label, href, moduleId: id, moduleName: name });
      }

      if (mounted) {
        setMergedItems(() => [...baseItems, ...items]);
      }
    })();

    return () => { mounted = false; };
  }, [pageModulesProp]);

  return (
    <nav className="sticky top-0 z-30 border-b bg-white">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex items-center justify-between gap-6">
          <ul className="flex gap-6 text-sm">
            {mergedItems.map((it) => {
              const active = it.href === "/" ? pathname === "/" : pathname?.startsWith(it.href);
              return (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    className={
                      "inline-block py-3 border-b-2 " +
                      (active ? "border-black font-medium" : "border-transparent text-gray-600 hover:text-black")
                    }
                  >
                    {it.label}
                  </Link>
                </li>
              );
            })}
            {authed ? (
              <li>
                <Link
                  href="/admin"
                  className={
                    "inline-block py-3 border-b-2 " +
                    (pathname?.startsWith("/admin")
                      ? "border-black font-medium"
                      : "border-transparent text-gray-600 hover:text-black")
                  }
                >
                  Admin
                </Link>
              </li>
            ) : null}
          </ul>

          <div className="py-3 flex items-center gap-3">
            {authed === null ? (
              <span className="text-xs text-gray-500">…</span>
            ) : authed ? (
              <>
                {email && <span className="hidden sm:inline text-xs text-gray-600">{email}</span>}
                <form action="/logout" method="post" className="inline">
                  <button type="submit" className="text-sm underline underline-offset-4">Logout</button>
                </form>
              </>
            ) : (
              <Link href={`/login?next=${encodeURIComponent(pathname || "/")}`} className="text-sm underline underline-offset-4">Login</Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
