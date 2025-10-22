// ...new file...
import React from "react";
import { notFound } from "next/navigation";
import { getPostBySlug } from "../../server/api";
import Link from "next/link";
import ShareButtons from "./ShareButtons";
import { marked } from "marked";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";              // add
import rehypeKatex from "rehype-katex";            // add
import "katex/dist/katex.min.css";                 // add
import CodeBlock from "../../components/CodeBlock.client";

type Post = {
  id?: number;
  title?: string | null;
  slug?: string;
  content?: string | null; // Markdown
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

// render markdown to HTML (you can add sanitization if needed)
function renderMarkdownToHtml(md?: string | null): string {
  if (!md) return "";
  const out = marked.parse(md);
  return typeof out === "string" ? out : String(out);
}
// plain-text excerpt derived from rendered HTML
function excerptFromHtml(html?: string | null, max = 220) {
  if (!html) return "";
  const text = String(html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return text.slice(0, max).trim().replace(/\s+\S*$/, "") + "…";
}

export default async function Page({ params }: { params: { slug: string } }) {
  const slug = decodeURIComponent(params.slug);
  if (!slug) return notFound();

  const post: Post | null = await getPostBySlug(slug);
  if (!post) return notFound();

  const md = post.content || "";
  const html = renderMarkdownToHtml(md);
  const safeTitle = post.title || "Untitled";

  const mdComponents = {
    // inline and block code (block via <pre/>)
    code: ({ inline, className, children, ...rest }: any) => {
      if (inline) {
        return (
          <code
            {...rest}
            style={{
              background: "#f6f8fa",
              padding: "2px 6px",
              borderRadius: 4,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
            }}
          >
            {children}
          </code>
        );
      }
      return <code {...rest} className={className}>{children}</code>;
    },
    pre: ({ children }: any) => {
      const child = Array.isArray(children) ? children[0] : children;
      const props = (child && (child as any).props) || {};
      const className: string = props.className || "";
      const lang = (className.match(/language-([\w-]+)/) || [,"plaintext"])[1];
      const raw = props.children;
      let code = "";
      if (typeof raw === "string") code = raw;
      else if (Array.isArray(raw)) code = raw.join("");
      else code = String(raw ?? "");
      return <CodeBlock code={code.replace(/\n$/, "")} language={lang} />;
    },
    // GFM table styles
    table: (props: any) => (
      <table
        {...props}
        style={{ width: "100%", borderCollapse: "collapse", margin: "0.75em 0", fontSize: 14 }}
      />
    ),
    thead: (props: any) => <thead {...props} />,
    tbody: (props: any) => <tbody {...props} />,
    tr: (props: any) => <tr {...props} style={{ borderBottom: "1px solid #e5e7eb" }} />,
    th: (props: any) => (
      <th
        {...props}
        style={{
          textAlign: "left",
          padding: "8px 10px",
          borderBottom: "2px solid #e5e7eb",
          background: "#f8fafc",
          fontWeight: 600,
        }}
      />
    ),
    td: (props: any) => (
      <td
        {...props}
        style={{ padding: "8px 10px", verticalAlign: "top", borderBottom: "1px solid #f1f5f9" }}
      />
    ),
    a: (props: any) => <a {...props} target="_blank" rel="noreferrer" style={{ color: "#0b66ff", textDecoration: "underline" }} />,
    // eslint-disable-next-line @next/next/no-img-element
    img: (props: any) => {
      const { src, alt, ...rest } = props ?? {};
      const s = typeof src === "string" ? src.trim() : "";
      if (!s) return null;
      return <img src={s} alt={typeof alt === "string" ? alt : ""} style={{ maxWidth: "100%", height: "auto", borderRadius: 6 }} {...rest} />;
    },
  };

  return (
    <div style={{ padding: 28, maxWidth: 1200, margin: "0 auto", color: "#111" }}>
      <Link href="/m/blog-posts" style={{ color: "#0b66ff", textDecoration: "none", marginBottom: 16, display: "inline-block" }}>
        ← Back to blog
      </Link>

      <article style={{ marginTop: 12 }}>
        <h1 style={{ margin: "8px 0 6px 0", fontSize: 34 }}>{safeTitle}</h1>
        <div style={{ color: "#888", fontSize: 13, marginBottom: 18 }}>{formatDate(post.published_at)}</div>

        <div style={{ marginBottom: 18, color: "#555" }}>{excerptFromHtml(html, 220)}</div>

        <div style={{ lineHeight: 1.7, color: "#222" }}>
          {post.content?.trim() ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}          // add math
              rehypePlugins={[rehypeKatex]}                    // add katex
              components={mdComponents as any}
            >
              {post.content || ""}
            </ReactMarkdown>
          ) : (
            <p>No content.</p>
          )}
        </div>

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
