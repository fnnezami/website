// ...new file...
import React from "react";
import { notFound } from "next/navigation";
import { getPostBySlug } from "../../server/api";
import Link from "next/link";
import ShareButtons from "./ShareButtons";

type Post = {
  id?: number;
  title?: string | null;
  slug?: string;
  content?: string | null; // content is HTML from rich editor
  published_at?: string | null;
  share_settings?: Record<string, boolean> | null;
};

function formatDate(d?: string | null) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return String(d);
  }
}

// plain-text excerpt for display above the rendered HTML
function excerptFromHtml(html?: string | null, max = 220) {
  if (!html) return "";
  const text = String(html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return text.slice(0, max).trim().replace(/\s+\S*$/, "") + "…";
}

export default async function PostPage({ params }: { params?: { slug?: string | Promise<string> } }) {
  // ensure we await params (Next.js may provide a thenable)
  const resolvedParams = params ? await params : undefined;
  const slug = resolvedParams?.slug;
  if (!slug) return notFound();

  const post: Post | null = await getPostBySlug(String(slug));
  // debug: verify what the API returns in the server console
  // remove this after debugging
  // eslint-disable-next-line no-console
  console.log("DEBUG getPostBySlug:", slug, post);

  if (!post) return notFound();

  const html = post.content || "";
  const safeTitle = post.title || "Untitled";

  return (
    <div style={{ padding: 28, maxWidth: 1200, margin: "0 auto", color: "#111" }}>
      <Link href="/m/blog-posts" style={{ color: "#0b66ff", textDecoration: "none", marginBottom: 16, display: "inline-block" }}>
        ← Back to blog
      </Link>

      <article style={{ marginTop: 12 }}>
        <h1 style={{ margin: "8px 0 6px 0", fontSize: 34 }}>{safeTitle}</h1>
        <div style={{ color: "#888", fontSize: 13, marginBottom: 18 }}>{formatDate(post.published_at)}</div>

        <div style={{ marginBottom: 18, color: "#555" }}>{excerptFromHtml(html, 220)}</div>

        <div
          style={{ lineHeight: 1.7, color: "#222" }}
          // content is stored as HTML from the rich editor; render it directly
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: html || "<p>No content.</p>" }}
        />

        {/* Share buttons: rendered client-side */}
        <div style={{ marginTop: 24 }}>
          <ShareButtons
            title={safeTitle}
            slug={post.slug || String(slug)}
            shareSettings={post.share_settings || {}}
          />
        </div>
      </article>
    </div>
  );
}
// ...new file...