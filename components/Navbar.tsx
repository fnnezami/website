// /components/Navbar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase";

const baseItems = [
  { label: "Resume", href: "/" },
  { label: "Publications", href: "/publications" },
  { label: "Projects", href: "/projects" },
];

export default function Navbar(props: { pageModules?: Array<any> }) {
  const pageModules = props.pageModules || [];
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

    const { data: sub } = supabaseBrowser.auth.onAuthStateChange((_evt, session) => {
      setAuthed(!!session);
      setEmail(session?.user?.email ?? null);
    });

    return () => { mounted = false; sub?.subscription?.unsubscribe?.(); };
  }, []);

  // merge base items and module pages so they render identically
  // NOTE: always link to the universal module route /m/<id> to keep modules self-contained
  const mergedItems = [
    ...baseItems,
    ...pageModules.map((m) => ({
      label: m.name || m.id,
      href: `/m/${m.id}`,
    })),
  ];

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
                  <button className="rounded-md bg-black text-white px-3 py-1.5 text-sm">Logout</button>
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
