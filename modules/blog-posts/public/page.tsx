// Server component exported by the blog-posts module.
// If this file exists the universal route will import and render it.
import React from "react";
// removed next/link import to force native navigation
import { listPublishedPosts } from "../server/api";

type Post = {
  id?: number;
  title?: string | null;
  slug?: string;
  excerpt?: string | null; // may contain HTML
  content?: string | null; // HTML from rich editor
  published_at?: string | null;
  archived?: boolean;
};

function formatDate(d?: string | null) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return String(d);
  }
}

// strip tags and collapse whitespace to produce a safe plaintext excerpt
function excerptFromHtml(html?: string | null, max = 280) {
  if (!html) return "";
  const text = String(html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return text.slice(0, max).trim().replace(/\s+\S*$/, "") + "…";
}

export default async function Page() {
  let posts: Post[] = [];
  try {
    const res: any = await listPublishedPosts();
    if (Array.isArray(res)) posts = res;
    else if (res && Array.isArray(res.posts)) posts = res.posts;
    else if (res && Array.isArray(res.data)) posts = res.data;
  } catch (err) {
    // resilient: show empty list on failure
    // eslint-disable-next-line no-console
    console.error("Failed to load posts:", (err as Error)?.message || err);
    posts = [];
  }

  posts = posts.map((p) => ({ ...p, title: p.title ?? "Untitled" }));

  posts.sort((a, b) => {
    const ta = a.published_at ? new Date(a.published_at).getTime() : 0;
    const tb = b.published_at ? new Date(b.published_at).getTime() : 0;
    return tb - ta;
  });

  const latest = posts.slice(0, 5);
  const older = posts.slice(5);

  return (
    <div style={{ display: "flex", gap: 28, padding: 28, alignItems: "flex-start", color: "#111" }}>
      <main style={{ flex: 1, minWidth: 0 }}>
        <header style={{ marginBottom: 18 }}>
          <h1 style={{ margin: 0, fontSize: 34 }}>Blog</h1>
          <p style={{ margin: "6px 0 0 0", color: "#666" }}>Thoughts, guides and updates.</p>
        </header>

        <section aria-labelledby="latest-posts" style={{ marginBottom: 24 }}>
          <h2 id="latest-posts" style={{ fontSize: 20, marginBottom: 12 }}>Latest</h2>
          <div style={{ display: "grid", gap: 16 }}>
            {latest.length === 0 && <div style={{ color: "#666" }}>No posts yet.</div>}
            {latest.map((p) => {
              const href = `/m/blog-posts/${encodeURIComponent(String(p.slug ?? p.id ?? ""))}`;
              return (
                <article
                  key={p.slug ?? p.id}
                  style={{
                    padding: 18,
                    borderRadius: 10,
                    border: "1px solid rgba(0,0,0,0.06)",
                    background: "#fff",
                    boxShadow: "0 6px 18px rgba(15,23,42,0.03)",
                  }}
                >
                  {/* force native navigation with plain anchor */}
                  <a href={href} style={{ textDecoration: "none", color: "inherit" }} aria-label={`Read ${p.title}`}>
                    <h3 style={{ margin: "0 0 8px 0" }}>{p.title}</h3>
                  </a>

                  <div style={{ color: "#888", fontSize: 13, marginBottom: 8 }}>{formatDate(p.published_at)}</div>

                  {/* show a plain-text excerpt derived from HTML (no raw tags) */}
                  <p style={{ margin: 0, color: "#333" }}>{excerptFromHtml(p.excerpt ?? p.content ?? "") || "No preview available."}</p>

                  <div style={{ marginTop: 12 }}>
                    <a
                      href={href}
                      // target/_self makes navigation explicit (not a new tab)
                      target="_self"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: 14,
                        color: "#0b66ff",
                        textDecoration: "none",
                        fontWeight: 600,
                      }}
                    >
                      Read more →
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {older.length > 0 && (
          <section aria-labelledby="older-posts" style={{ marginTop: 8 }}>
            <h2 id="older-posts" style={{ fontSize: 18, marginBottom: 12 }}>Older posts</h2>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
              {older.map((p) => (
                <li key={p.slug ?? p.id}>
                  <a href={`/m/blog-posts/${encodeURIComponent(String(p.slug ?? p.id ?? ""))}`} style={{ color: "#0b66ff", textDecoration: "none" }}>
                    {p.title}
                    <span style={{ color: "#666", fontSize: 13, marginLeft: 8 }}>— {formatDate(p.published_at)}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      <aside
        style={{
          width: 320,
          minWidth: 220,
          borderLeft: "1px solid rgba(0,0,0,0.04)",
          paddingLeft: 24,
        }}
        aria-labelledby="sidebar"
      >
        <div id="sidebar" style={{ position: "sticky", top: 24 }}>
          <div style={{ marginBottom: 18 }}>
            <h3 style={{ margin: "0 0 8px 0", fontSize: 16 }}>Quick links</h3>
            <nav>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", color: "#0b66ff", display: "grid", gap: 6 }}>
                <li>
                  <a href="/m/blog-posts" style={{ textDecoration: "none", color: "#0b66ff" }}>
                    All posts
                  </a>
                </li>
                <li>
                  <a href="/m/blog-posts?archived=1" style={{ textDecoration: "none", color: "#0b66ff" }}>
                    Archived
                  </a>
                </li>
              </ul>
            </nav>
          </div>

          <div style={{ marginBottom: 18 }}>
            <h4 style={{ margin: "0 0 8px 0", fontSize: 14 }}>Recent</h4>
            {posts.length === 0 ? (
              <div style={{ color: "#666" }}>No posts</div>
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {posts.slice(0, 6).map((p) => (
                  <li key={p.slug ?? p.id} style={{ marginBottom: 8 }}>
                    <a href={`/m/blog-posts/${encodeURIComponent(String(p.slug ?? p.id ?? ""))}`} style={{ color: "#0b66ff", textDecoration: "none" }}>
                      {p.title}
                    </a>
                    <div style={{ color: "#888", fontSize: 12 }}>{formatDate(p.published_at)}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h4 style={{ margin: "0 0 8px 0", fontSize: 14 }}>Archived</h4>
            <div style={{ color: "#666" }}>See archived filter above.</div>
          </div>
        </div>
      </aside>
    </div>
  );
}

// async function ArchivedList() {
//   const archived: Post[] = (await (api as any).listArchivedPosts?.()) || [];
//   if (!archived || archived.length === 0) {
//     return <div style={{ color: "#666" }}>No archived posts.</div>;
//   }
//   return (
//     <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
//       {archived.map((p) => (
//         <li key={p.slug ?? p.id} style={{ marginBottom: 8 }}>
//           <Link href={`/m/blog-posts/${p.slug ?? ""}`} style={{ color: "#0b66ff", textDecoration: "none" }}>
//             {p.title}
//           </Link>
//           <div style={{ color: "#888", fontSize: 12 }}>{formatDate(p.published_at)}</div>
//         </li>
//       ))}
//     </ul>
//   );
// }