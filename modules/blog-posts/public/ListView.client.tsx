"use client";

import React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Post = {
  id?: number | string;
  title?: string | null;
  slug?: string;
  summary?: string | null;
  content?: string | null;
  archived?: boolean | string | number | null;
  created_at?: string | Date | number | null;
  updated_at?: string | Date | number | null;
  published_at?: string | Date | number | null;
  createdAt?: string | Date | number | null;
  updatedAt?: string | Date | number | null;
  date?: string | Date | number | null;
};

function toBool(v: any): boolean {
  return v === true || v === "true" || v === 1 || v === "1" || v === "t" || v === "T";
}
function coerceISO(v: any): string | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}
function postDateISO(p: Post): string | null {
  return (
    coerceISO((p as any).published_at) ||
    coerceISO((p as any).publishedAt) ||
    coerceISO((p as any).date) ||
    coerceISO(p.created_at) ||
    coerceISO((p as any).createdAt) ||
    coerceISO(p.updated_at) ||
    coerceISO((p as any).updatedAt) ||
    null
  );
}
function formatDate(iso?: string | null) {
  if (!iso) return "";
  try {
    // Deterministic across server/client
    return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(iso));
  } catch {
    return String(iso);
  }
}
function excerptFromHtml(html?: string | null, max = 220) {
  if (!html) return "";
  const text = String(html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return text.slice(0, max).trim().replace(/\s+\S*$/, "") + "…";
}
function groupByYear(posts: Post[]) {
  const map = new Map<number | "Undated", Post[]>();
  for (const p of posts) {
    const iso = postDateISO(p);
    const y = iso ? new Date(iso).getFullYear() : "Undated";
    map.set(y, [...(map.get(y) || []), p]);
  }
  const entries = Array.from(map.entries()).map(([year, items]) => ({
    year,
    items: items.sort((a, b) => {
      const ta = postDateISO(a) ? +new Date(postDateISO(a)!) : 0;
      const tb = postDateISO(b) ? +new Date(postDateISO(b)!) : 0;
      return tb - ta;
    }),
  }));
  entries.sort((a, b) => {
    if (a.year === "Undated") return 1;
    if (b.year === "Undated") return -1;
    return (b.year as number) - (a.year as number);
  });
  return entries;
}

export default function ListView({ posts }: { posts: Post[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const archivedMode = sp.get("archived") === "1";

  const shown = posts.filter((p) => (archivedMode ? toBool(p.archived) : !toBool(p.archived)));
  const grouped = groupByYear(shown);
  const years = grouped.map((g) => String(g.year)).filter((y) => y !== "Undated");
  const recent = shown.slice(0, 6);

  function setArchived(on: boolean) {
    const q = new URLSearchParams(sp.toString());
    if (on) q.set("archived", "1");
    else q.delete("archived");
    const qs = q.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const allHref = (() => {
    const q = new URLSearchParams(sp.toString());
    q.delete("archived");
    const s = q.toString();
    return s ? `?${s}` : "?";
  })();
  const archivedHref = (() => {
    const q = new URLSearchParams(sp.toString());
    q.set("archived", "1");
    return `?${q.toString()}`;
  })();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      <section className="lg:col-span-8">
        {shown.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center text-gray-600">No posts yet.</div>
        ) : (
          <div className="space-y-10">
            {grouped.map(({ year, items }) => (
              <div key={String(year)}>
                <h2 id={`y-${String(year)}`} className="mb-4 text-xl font-semibold tracking-tight">
                  {String(year)}
                </h2>
                <div className="space-y-8">
                  {items.map((p) => {
                    const href = `/m/blog-posts/${encodeURIComponent(String(p.slug ?? p.id ?? ""))}`;
                    return (
                      <article key={p.slug ?? p.id} className="rounded-xl border bg-white p-5 transition-shadow hover:shadow-sm">
                        <a href={href} className="no-underline text-inherit group">
                          <h3 className="text-2xl font-semibold leading-snug group-hover:underline">{p.title ?? "Untitled"}</h3>
                        </a>
                        <div className="mt-2 text-xs text-gray-500" suppressHydrationWarning>
                          {formatDate(postDateISO(p))}
                        </div>
                        <p className="mt-4 text-gray-700">
                          {excerptFromHtml(p.summary ?? p.content ?? "", 280) || "No preview available."}
                        </p>
                        <div className="mt-4">
                          <a href={href} className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700">
                            Read more <span aria-hidden>→</span>
                          </a>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <aside className="lg:col-span-4">
        <div className="sticky top-6 space-y-6">
          {/* Replace buttons with a clear toggle */}
          <div className="rounded-xl border bg-white p-5">
            <h4 className="text-sm font-semibold text-gray-900">Filter</h4>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm text-gray-700">Archived only</span>
              <button
                type="button"
                role="switch"
                aria-checked={archivedMode}
                onClick={() => setArchived(!archivedMode)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                  archivedMode ? "bg-gray-900" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                    archivedMode ? "translate-x-5" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              {archivedMode ? "Showing archived posts." : "Showing non-archived posts."}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5">
            <h5 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Jump to year</h5>
            {years.length === 0 ? (
              <div className="mt-2 text-sm text-gray-600">—</div>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {years.map((y) => (
                  <a
                    key={y}
                    href={`#y-${y}`}
                    className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-800 hover:border-gray-300 hover:shadow-sm transition"
                  >
                    {y}
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-white p-5">
            <h5 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Recent</h5>
            {recent.length === 0 ? (
              <div className="mt-2 text-sm text-gray-600">No posts</div>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {recent.map((p) => (
                  <li key={p.slug ?? p.id}>
                    <a href={`/m/blog-posts/${encodeURIComponent(String(p.slug ?? p.id ?? ""))}`} className="text-blue-600 hover:text-blue-700 no-underline">
                      {p.title ?? "Untitled"}
                    </a>
                    <div className="text-xs text-gray-500" suppressHydrationWarning>
                      {formatDate(postDateISO(p))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}