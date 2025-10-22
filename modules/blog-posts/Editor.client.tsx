"use client";

import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import CodeBlock from "./components/CodeBlock.client"; // <-- add this

// Inline icons (no extra deps) — clearer, colorized
const Icon = {
  link: (p: any) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" {...p} aria-hidden="true">
      <path d="M13.5 6.75h2.25a3.75 3.75 0 1 1 0 7.5H13.5" stroke="#0b66ff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10.5 17.25H8.25a3.75 3.75 0 1 1 0-7.5H10.5" stroke="#0b66ff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7.5 12h9" stroke="#0b66ff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  image: (p: any) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" {...p} aria-hidden="true">
      <rect x="3" y="4" width="18" height="14" rx="2.5" stroke="#10b981" strokeWidth="1.8"/>
      <circle cx="16.5" cy="9" r="2" fill="#10b981"/>
      <path d="M5.5 17l4.2-5.2 3.1 4 2.4-3 3.8 4.2H5.5z" fill="#10b981" opacity="0.9"/>
    </svg>
  ),
  hr: (p: any) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" {...p} aria-hidden="true">
      <path d="M4 12h16" stroke="#6b7280" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  eye: (p: any) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" {...p} aria-hidden="true">
      <path d="M2.5 12s3.8-7 9.5-7 9.5 7 9.5 7-3.8 7-9.5 7S2.5 12 2.5 12z" stroke="#8b5cf6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="12" cy="12" r="3" stroke="#8b5cf6" strokeWidth="1.8"/>
    </svg>
  ),
  codeInline: (p: any) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" {...p} aria-hidden="true">
      <path d="M8.5 8.5 5 12l3.5 3.5" stroke="#8b5cf6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M15.5 8.5 19 12l-3.5 3.5" stroke="#8b5cf6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  codeBlock: (p: any) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" {...p} aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="#8b5cf6" strokeWidth="1.8"/>
      <path d="M8 10h8M8 14h5" stroke="#8b5cf6" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
  copy: (p: any) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" {...p} aria-hidden="true">
      <rect x="9" y="9" width="11" height="11" rx="2" stroke="#e5e7eb" strokeWidth="1.6"/>
      <rect x="4" y="4" width="11" height="11" rx="2" stroke="#e5e7eb" strokeWidth="1.6" opacity="0.6"/>
    </svg>
  ),
  table: (p: any) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" {...p} aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="#0ea5e9" strokeWidth="1.8"/>
      <path d="M3 10h18M3 15h18M9 5v14M15 5v14" stroke="#0ea5e9" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
  mathInline: (p: any) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" {...p} aria-hidden="true">
      <path d="M4 13l3 5 4-12" stroke="#059669" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M15 12l3 3M18 12l-3 3" stroke="#059669" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  ),
  mathBlock: (p: any) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" {...p} aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="#059669" strokeWidth="1.8"/>
      <path d="M7 14l2 4 3-8" stroke="#059669" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M15 12l2 2M17 12l-2 2" stroke="#059669" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
};

type Props = {
  valueMd?: string;                 // raw markdown
  onChangeMd: (md: string) => void; // persist markdown
  onUploadImage?: (file: File) => Promise<string>; // returns URL
};

function insertAtSelection(ta: HTMLTextAreaElement, render: (sel: string) => string) {
  const { selectionStart, selectionEnd, value } = ta;
  const before = value.slice(0, selectionStart);
  const sel = value.slice(selectionStart, selectionEnd);
  const after = value.slice(selectionEnd);
  const chunk = render(sel);
  const next = before + chunk + after;
  const pos = before.length + chunk.length;
  ta.value = next;
  ta.setSelectionRange(pos, pos);
  ta.focus();
  return next;
}

// Add: simple URL sanitizer
function sanitizeUrl(input: string): string {
  let url = (input || "").trim();
  if (!url) return "";
  if (/^(mailto:|tel:)/i.test(url)) return url; // allow mailto/tel
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)) url = "https://" + url;
  try {
    const u = new URL(url);
    if (!/^https?:$|^mailto:$|^tel:$/.test(u.protocol)) return "";
    return u.toString();
  } catch {
    return "";
  }
}

// Add: derive a lightweight preview without network fetch (favicon/image/youtube)
function getLinkPreview(url: string): { kind: "image" | "youtube" | "site"; host: string; thumb?: string } | null {
  try {
    const u = new URL(url);
    const host = u.hostname;
    const path = u.pathname || "";
    if (/\.(png|jpe?g|gif|webp|svg)$/i.test(path)) {
      return { kind: "image", host, thumb: url };
    }
    // youtube
    let vid = "";
    if (/(www\.)?youtube\.com$/i.test(host)) {
      const v = u.searchParams.get("v");
      if (v) vid = v;
      if (!vid && u.pathname.startsWith("/shorts/")) vid = u.pathname.split("/")[2] || "";
    } else if (/^(youtu\.be)$/i.test(host)) {
      vid = u.pathname.replace(/^\/+/, "");
    }
    if (vid) return { kind: "youtube", host, thumb: `https://img.youtube.com/vi/${vid}/hqdefault.jpg` };
    // site favicon
    const favicon = `https://www.google.com/s2/favicons?sz=64&domain_url=${u.origin}`;
    return { kind: "site", host, thumb: favicon };
  } catch {
    return null;
  }
}

// Add helpers to upload images to your storage (same API used in Projects admin)
function extFromFilename(name: string) {
  const m = String(name || "").toLowerCase().match(/\.(png|jpg|jpeg|webp|gif|svg)$/i);
  return m ? m[1] : "png";
}
async function uploadViaApi(path: string, file: File) {
  const fd = new FormData();
  fd.append("path", path);
  fd.append("file", file);
  const res = await fetch("/api/admin/storage/upload", { method: "POST", body: fd });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j?.ok === false) throw new Error(j?.error || `Upload failed (${res.status})`);
  return j.publicUrl as string;
}
// Default uploader if onUploadImage not provided
async function defaultUploadImage(file: File) {
  const ext = extFromFilename(file.name);
  // Adjust the path prefix to your bucket/folder convention if different
  const path = `blog/drafts/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  return uploadViaApi(path, file);
}

export default function MarkdownEditor({ valueMd, onChangeMd, onUploadImage }: Props) {
  const [md, setMd] = useState<string>("");
  const [showPreview, setShowPreview] = useState(true);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  // NEW: link dialog state
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkSelText, setLinkSelText] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const urlInputRef = useRef<HTMLInputElement | null>(null);

  // NEW: image dialog state (no uploads, URL only)
  const [imageOpen, setImageOpen] = useState(false);
  const [imageSelText, setImageSelText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageAlt, setImageAlt] = useState("");
  const imageUrlInputRef = useRef<HTMLInputElement | null>(null);

  // NEW: open preview overlay state
  const [previewOpen, setPreviewOpen] = useState(false);

  // Table picker state
  const [tableOpen, setTableOpen] = useState(false);
  const [tableHover, setTableHover] = useState<{ r: number; c: number }>({ r: 0, c: 0 });
  const [tablePos, setTablePos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const tableBtnRef = useRef<HTMLButtonElement | null>(null);

  // Add near other state
  const [linkSel, setLinkSel] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
  const [imageSel, setImageSel] = useState<{ start: number; end: number }>({ start: 0, end: 0 });

  // Initialize once (component is keyed by post/new)
  useEffect(() => {
    setMd(valueMd || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stable notify parent
  const onChangeRef = useRef(onChangeMd);
  useEffect(() => { onChangeRef.current = onChangeMd; }, [onChangeMd]);
  useEffect(() => { onChangeRef.current(md); }, [md]);

  // Helper to apply insertion at a saved range
  function applyAtRange(
    value: string,
    start: number,
    end: number,
    make: string | ((sel: string) => string)
  ) {
    const before = value.slice(0, start);
    const sel = value.slice(start, end);
    const after = value.slice(end);
    const md = typeof make === "function" ? make(sel) : make;
    const next = before + md + after;
    const caret = (before + md).length;
    return { next, caret };
  }

  // open link dialog, capture current selection
  function openLinkDialog() {
    const ta = taRef.current;
    if (ta) {
      const start = ta.selectionStart ?? ta.value.length;
      const end = ta.selectionEnd ?? start;
      setLinkSel({ start, end });
      const sel = ta.value.slice(start, end);
      setLinkText(sel);
    } else {
      setLinkSel({ start: md.length, end: md.length }); // CHANGED from valueMd.length
      setLinkText("");
    }
    setLinkUrl("");
    setLinkOpen(true);
    setTimeout(() => urlInputRef.current?.focus(), 0);
  }

  function closeLinkDialog() {
    setLinkOpen(false);
  }

  // Insert link at saved range
  function insertLink() {
    const ta = taRef.current;
    const safe = sanitizeUrl(linkUrl);
    if (!safe) return;
    const text = (linkText || "link").trim();
    const { next, caret } = applyAtRange(md, linkSel.start, linkSel.end, `[${text}](${safe})`); // CHANGED from valueMd
    setMd(next);
    setLinkOpen(false);
    queueMicrotask(() => {
      try {
        if (ta) {
          ta.focus();
          ta.selectionStart = ta.selectionEnd = caret;
        }
      } catch {}
    });
  }

  // NEW: image dialog helpers (URL only, with preview)
  function openImageDialog() {
    const ta = taRef.current;
    if (ta) {
      const start = ta.selectionStart ?? ta.value.length;
      const end = ta.selectionEnd ?? start;
      setImageSel({ start, end });
      const sel = ta.value.slice(start, end);
      setImageAlt(sel);
    } else {
      setImageSel({ start: md.length, end: md.length }); // CHANGED from valueMd.length
      setImageAlt("");
    }
    setImageUrl("");
    setImageOpen(true);
    setTimeout(() => imageUrlInputRef.current?.focus(), 0);
  }
  function closeImageDialog() {
    setImageOpen(false);
  }
  // Insert image at saved range
  function insertImage() {
    const ta = taRef.current;
    const safe = sanitizeUrl(imageUrl);
    if (!safe) return;
    const alt = (imageAlt || "image").trim();
    const { next, caret } = applyAtRange(md, imageSel.start, imageSel.end, `![${alt}](${safe})`); // CHANGED from valueMd
    setMd(next);
    setImageOpen(false);
    queueMicrotask(() => {
      try {
        if (ta) {
          ta.focus();
          ta.selectionStart = ta.selectionEnd = caret;
        }
      } catch {}
    });
  }

  function buildTableMd(rows: number, cols: number) {
    const headers = Array.from({ length: cols }, (_, i) => `Header ${i + 1}`).join(" | ");
    const sep = Array.from({ length: cols }, () => "---").join(" | ");
    const body = Array.from({ length: rows }, () => Array.from({ length: cols }, () => " ").join(" | ")).join("\n");
    return `| ${headers} |\n| ${sep} |\n${rows > 0 ? `| ${body.split("\n").join(" |\n| ")} |` : ""}`;
  }

  function openTablePicker() {
    const btn = tableBtnRef.current;
    if (!btn) { setTableOpen(true); return; }
    const rect = btn.getBoundingClientRect();
    // Position the picker under the button
    setTablePos({ top: rect.bottom + 8, left: rect.left });
    setTableHover({ r: 0, c: 0 });
    setTableOpen(true);
  }

  function insertTable(rows: number, cols: number) {
    const ta = taRef.current; if (!ta) return;
    const mdTable = `\n\n${buildTableMd(rows, cols)}\n\n`;
    setMd(insertAtSelection(ta, () => mdTable));
    setTableOpen(false);
  }

  // In your editor preview components mapping, reuse CodeBlock for block code and add tactile copy there too via the component.
  const mdComponents = {
    h1: (props: any) => <h1 {...props} style={{ fontSize: 28, fontWeight: 800, margin: "1em 0 0.6em" }} />,
    h2: (props: any) => <h2 {...props} style={{ fontSize: 24, fontWeight: 700, margin: "1em 0 0.6em" }} />,
    h3: (props: any) => <h3 {...props} style={{ fontSize: 20, fontWeight: 700, margin: "0.9em 0 0.5em" }} />,
    h4: (props: any) => <h4 {...props} style={{ fontSize: 16, fontWeight: 700, margin: "0.8em 0 0.4em" }} />,
    p: (props: any) => <p {...props} style={{ margin: "0.75em 0" }} />,
    ul: (props: any) => <ul {...props} style={{ paddingLeft: "1.25rem", listStyle: "disc", margin: "0.75em 0" }} />,
    ol: (props: any) => <ol {...props} style={{ paddingLeft: "1.25rem", listStyle: "decimal", margin: "0.75em 0" }} />,
    li: (props: any) => <li {...props} style={{ margin: "0.25em 0" }} />,
    blockquote: (props: any) => <blockquote {...props} style={{ margin: "0.8em 0", paddingLeft: "0.9em", borderLeft: "3px solid #e5e7eb", color: "#555" }} />,
    // Inline and block code with copy button for blocks
    code: ({ inline, className, children, ...rest }: any) => {
      // Inline code only (light pill)
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
      // Let pre handle fenced blocks
      return <code {...rest} className={className}>{children}</code>;
    },
    pre: ({ children }: any) => {
      // children is typically a single <code> with className like language-js
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
    a: (props: any) => <a {...props} target="_blank" rel="noreferrer" style={{ color: "#0b66ff", textDecoration: "underline" }} />,
    // eslint-disable-next-line @next/next/no-img-element
    img: (props: any) => {
      const { src, alt, ...rest } = props ?? {};
      const s = typeof src === "string" ? src.trim() : "";
      if (!s) return null;
      return <img src={s} alt={typeof alt === "string" ? alt : ""} style={{ maxWidth: "100%", height: "auto", borderRadius: 6 }} {...rest} />;
    },
    table: (props: any) => (
      <table
        {...props}
        style={{
          width: "100%",
          borderCollapse: "collapse",
          margin: "0.75em 0",
          fontSize: 14,
        }}
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
        style={{
          padding: "8px 10px",
          verticalAlign: "top",
          borderBottom: "1px solid #f1f5f9",
        }}
      />
    ),
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        {/* Headings */}
        <select
          title="Headings"
          defaultValue=""
          onChange={(e) => {
            const ta = taRef.current; if (!ta) return;
            const map: Record<string, string> = { h1: "#", h2: "##", h3: "###", h4: "####" };
            const v = e.target.value;
            if (!map[v]) return;
            setMd(insertAtSelection(ta, (s) => `\n\n${map[v]} ${s || "Heading"}\n\n`));
            e.currentTarget.selectedIndex = 0;
          }}
          style={{ height: 32, borderRadius: 6, border: "1px solid #e6e6e6", background: "#fff", padding: "0 8px", fontSize: 13 }}
        >
          <option disabled value="">Headings</option>
          <option value="h1">H1</option>
          <option value="h2">H2</option>
          <option value="h3">H3</option>
          <option value="h4">H4</option>
        </select>

        {/* Lists (dropdown stays for lists only) */}
        <select
          title="Lists"
          defaultValue=""
          onChange={(e) => {
            const ta = taRef.current; if (!ta) return;
            const v = e.target.value;
            if (v === "ul") setMd(insertAtSelection(ta, (s) => (s ? s.split(/\n/).map((l) => `- ${l}`).join("\n") : "- item\n- item")));
            if (v === "ol") setMd(insertAtSelection(ta, (s) => (s ? s.split(/\n/).map((l, i) => `${i + 1}. ${l}`).join("\n") : "1. item\n2. item")));
            e.currentTarget.selectedIndex = 0;
          }}
          style={{ height: 32, borderRadius: 6, border: "1px solid #e6e6e6", background: "#fff", padding: "0 8px", fontSize: 13 }}
        >
          <option disabled value="">Lists</option>
          <option value="ul">Bulleted list</option>
          <option value="ol">Numbered list</option>
        </select>

        {/* Inline */}
        <button
          type="button"
          title="Bold"
          onClick={() => { const ta = taRef.current; if (!ta) return; setMd(insertAtSelection(ta, (s) => `**${s || "bold"}**`)); }}
          style={{ height: 32, minWidth: 32, borderRadius: 6, padding: "0 10px", border: "1px solid #e6e6e6", background: "#fff", fontSize: 13, fontWeight: 600 }}
        >
          B
        </button>
        <button
          type="button"
          title="Italic"
          onClick={() => { const ta = taRef.current; if (!ta) return; setMd(insertAtSelection(ta, (s) => `*${s || "italic"}*`)); }}
          style={{ height: 32, minWidth: 32, borderRadius: 6, padding: "0 10px", border: "1px solid #e6e6e6", background: "#fff", fontSize: 13, fontWeight: 600 }}
        >
          I
        </button>
        {/* Replace single code button with two icon buttons */}
        <button
          type="button"
          title="Inline code"
          aria-label="Inline code"
          onClick={() => { const ta = taRef.current; if (!ta) return; setMd(insertAtSelection(ta, (s) => `\`${s || "code"}\``)); }}
          style={{ height: 32, width: 32, display: "grid", placeItems: "center", borderRadius: 6, border: "1px solid #e6e6e6", background: "#fff" }}
        >
          <Icon.codeInline />
        </button>
        <button
          type="button"
          title="Code block"
          aria-label="Code block"
          onClick={() => { const ta = taRef.current; if (!ta) return; setMd(insertAtSelection(ta, (s) => `\n\n\`\`\`language\n${s || "code"}\n\`\`\`\n\n`)); }}
          style={{ height: 32, width: 32, display: "grid", placeItems: "center", borderRadius: 6, border: "1px solid #e6e6e6", background: "#fff" }}
        >
          <Icon.codeBlock />
        </button>

        {/* Inline math button */}
        <button
          type="button"
          title="Inline math"
          aria-label="Inline math"
          onClick={() => { const ta = taRef.current; if (!ta) return; setMd(insertAtSelection(ta, (s) => `$${s || "a+b"}$`)); }}
          style={{ height: 32, width: 32, display: "grid", placeItems: "center", borderRadius: 6, border: "1px solid #e6e6e6", background: "#fff" }}
        >
          <Icon.mathInline />
        </button>

        {/* Block math button */}
        <button
          type="button"
          title="Block math"
          aria-label="Block math"
          onClick={() => { const ta = taRef.current; if (!ta) return; setMd(insertAtSelection(ta, (s) => `\n\n$$\n${s || "E=mc^2"}\n$$\n\n`)); }}
          style={{ height: 32, width: 32, display: "grid", placeItems: "center", borderRadius: 6, border: "1px solid #e6e6e6", background: "#fff" }}
        >
          <Icon.mathBlock />
        </button>

        {/* Quote (unchanged text button) */}
        <button
          type="button"
          title="Quote"
          onClick={() => { const ta = taRef.current; if (!ta) return; setMd(insertAtSelection(ta, (s) => (s ? s.split(/\n/).map((l) => `> ${l}`).join("\n") : "> quote"))); }}
          style={{ height: 32, borderRadius: 6, padding: "0 10px", border: "1px solid #e6e6e6", background: "#fff", fontSize: 13 }}
        >
          Quote
        </button>

        {/* Horizontal rule icon button */}
        <button
          type="button"
          title="Horizontal rule"
          aria-label="Horizontal rule"
          onClick={() => { const ta = taRef.current; if (!ta) return; setMd(insertAtSelection(ta, () => `\n\n---\n\n`)); }}
          style={{ height: 32, width: 32, display: "grid", placeItems: "center", borderRadius: 6, border: "1px solid #e6e6e6", background: "#fff" }}
        >
          <Icon.hr />
        </button>

        {/* Link icon button */}
        <button
          type="button"
          title="Insert link"
          aria-label="Insert link"
          onClick={openLinkDialog}
          style={{ height: 32, width: 32, display: "grid", placeItems: "center", borderRadius: 6, border: "1px solid #e6e6e6", background: "#fff" }}
        >
          <Icon.link />
        </button>

        {/* Image icon button */}
        <button
          type="button"
          title="Insert image"
          aria-label="Insert image"
          onClick={openImageDialog}
          style={{ height: 32, width: 32, display: "grid", placeItems: "center", borderRadius: 6, border: "1px solid #e6e6e6", background: "#fff" }}
        >
          <Icon.image />
        </button>

        {/* Table picker button */}
        <button
          ref={tableBtnRef}
          type="button"
          title="Insert table"
          aria-label="Insert table"
          onClick={openTablePicker}
          style={{ height: 32, width: 32, display: "grid", placeItems: "center", borderRadius: 6, border: "1px solid #e6e6e6", background: "#fff" }}
        >
          <Icon.table />
        </button>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, color: "#444" }}>Preview</span>
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            aria-pressed={showPreview}
            style={{ width: 44, height: 26, borderRadius: 16, padding: 2, background: showPreview ? "#0b66ff" : "#e6e6e6", border: "none", display: "inline-flex", alignItems: "center", cursor: "pointer" }}
          >
            <span style={{ width: 20, height: 20, borderRadius: 12, background: "#fff", transform: showPreview ? "translateX(18px)" : "translateX(0)", transition: "transform 120ms ease" }} />
          </button>

          {/* NEW: Open Preview overlay button */}
          <button
            type="button"
            title="Open preview"
            aria-label="Open preview"
            onClick={() => setPreviewOpen(true)}
            style={{ height: 32, display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 6, border: "1px solid #e6e6e6", background: "#fff", padding: "0 10px" }}
          >
            <Icon.eye /> <span style={{ fontSize: 13 }}>Open</span>
          </button>
        </div>
      </div>

      {/* Resizable shell */}
      <div
        style={{
          resize: "vertical",
          overflow: "auto",
          minHeight: 300,
          maxHeight: "85vh",
          // no extra border to avoid double borders with textarea/preview
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: showPreview ? "1fr 1fr" : "1fr",
            gap: 12,
            height: "100%",
            minHeight: 300,
          }}
        >
          {/* Editor */}
          <textarea
            ref={taRef}
            value={md} // CHANGED from valueMd
            onChange={(e) => setMd(e.target.value)}
            rows={18}
            style={{
              width: "100%",
              height: "100%",
              boxSizing: "border-box",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              fontSize: 14,
              padding: 12,
              borderRadius: 8,
              border: "1px solid #ccc",
              resize: "none",
            }}
          />

          {/* Live Preview (only when enabled) */}
          {showPreview && (
            <div
              style={{
                height: "100%",
                overflow: "auto",
                border: "1px solid #eee",
                borderRadius: 8,
                padding: 12,
                background: "#fff",
              }}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}          // add math
                rehypePlugins={[rehypeKatex]}                    // add katex
                components={mdComponents as any}
                children={typeof md === "string" ? md : ""}
              />
            </div>
          )}
        </div>
      </div>

      {/* Link Insert Dialog */}
      {linkOpen && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) closeLinkDialog(); }}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 1000,
            display: "flex", alignItems: "center", justifyContent: "center", padding: 16
          }}
        >
          <div style={{ width: "min(560px, 96vw)", background: "#fff", borderRadius: 12, boxShadow: "0 12px 40px rgba(0,0,0,0.18)", padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Insert link</div>
              <button type="button" onClick={closeLinkDialog} aria-label="Close" style={{ border: "none", background: "transparent", fontSize: 18, cursor: "pointer" }}>×</button>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <label style={{ fontSize: 13, color: "#333" }}>
                URL
                <input
                  ref={urlInputRef}
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://example.com"
                  style={{ width: "100%", marginTop: 6, padding: "9px 10px", border: "1px solid #e6e6e6", borderRadius: 8, fontSize: 14 }}
                />
              </label>

              <label style={{ fontSize: 13, color: "#333" }}>
                Text to display
                <input
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                  placeholder={linkSelText || "link"}
                  style={{ width: "100%", marginTop: 6, padding: "9px 10px", border: "1px solid #e6e6e6", borderRadius: 8, fontSize: 14 }}
                />
              </label>

              {/* Preview */}
              {(() => {
                const safe = sanitizeUrl(linkUrl);
                if (!safe) return null;
                const p = getLinkPreview(safe);
                if (!p) return null;
                return (
                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 10, border: "1px solid #f0f0f0", borderRadius: 10, background: "#fafafa" }}>
                    {p.thumb && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.thumb} alt="" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 8 }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#111", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {linkText || linkSelText || safe}
                      </div>
                      <div style={{ fontSize: 12, color: "#666", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {p.host}
                      </div>
                    </div>
                    <a href={safe} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#0b66ff" }}>Open</a>
                  </div>
                );
              })()}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
              <button type="button" onClick={closeLinkDialog} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e6e6e6", background: "#fff", fontSize: 14 }}>Cancel</button>
              <button
                type="button"
                onClick={insertLink}
                disabled={!sanitizeUrl(linkUrl)}
                style={{ padding: "8px 12px", borderRadius: 8, border: "none", background: sanitizeUrl(linkUrl) ? "#0b66ff" : "#cbdcff", color: "#fff", fontSize: 14, cursor: sanitizeUrl(linkUrl) ? "pointer" : "default" }}
              >
                Insert
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NEW: Image Insert Dialog (URL + preview) */}
      {imageOpen && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) closeImageDialog(); }}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 1000,
            display: "flex", alignItems: "center", justifyContent: "center", padding: 16
          }}
        >
          <div style={{ width: "min(560px, 96vw)", background: "#fff", borderRadius: 12, boxShadow: "0 12px 40px rgba(0,0,0,0.18)", padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Insert image</div>
              <button type="button" onClick={closeImageDialog} aria-label="Close" style={{ border: "none", background: "transparent", fontSize: 18, cursor: "pointer" }}>×</button>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <label style={{ fontSize: 13, color: "#333" }}>
                Image URL
                <input
                  ref={imageUrlInputRef}
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  style={{ width: "100%", marginTop: 6, padding: "9px 10px", border: "1px solid #e6e6e6", borderRadius: 8, fontSize: 14 }}
                />
              </label>

              <label style={{ fontSize: 13, color: "#333" }}>
                Alt text (optional)
                <input
                  value={imageAlt}
                  onChange={(e) => setImageAlt(e.target.value)}
                  placeholder={imageSelText || "image"}
                  style={{ width: "100%", marginTop: 6, padding: "9px 10px", border: "1px solid #e6e6e6", borderRadius: 8, fontSize: 14 }}
                />
              </label>

              {/* Preview */}
              {(() => {
                const safe = sanitizeUrl(imageUrl);
                if (!safe) return null;
                return (
                  <div style={{ display: "grid", gap: 8 }}>
                    <span style={{ fontSize: 12, color: "#555" }}>Preview</span>
                    <div style={{ display: "grid", placeItems: "center", border: "1px solid #f0f0f0", borderRadius: 10, background: "#fafafa", padding: 10, minHeight: 120 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={safe} alt={imageAlt || "preview"} style={{ maxWidth: "100%", maxHeight: 260, borderRadius: 6 }} />
                    </div>
                  </div>
                );
              })()}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
              <button type="button" onClick={closeImageDialog} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e6e6e6", background: "#fff", fontSize: 14 }}>Cancel</button>
              <button
                type="button"
                onClick={insertImage}
                disabled={!sanitizeUrl(imageUrl)}
                style={{ padding: "8px 12px", borderRadius: 8, border: "none", background: sanitizeUrl(imageUrl) ? "#0b66ff" : "#cbdcff", color: "#fff", fontSize: 14, cursor: sanitizeUrl(imageUrl) ? "pointer" : "default" }}
              >
                Insert
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NEW: Full-screen preview overlay */}
      {previewOpen && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setPreviewOpen(false); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1100, display: "flex", justifyContent: "center", overflow: "auto" }}
        >
          <div style={{ maxWidth: 800, width: "100%", borderRadius: 12, overflow: "hidden" }}>
            {/* Close button (top right) */}
            <button
              type="button"
              onClick={() => setPreviewOpen(false)}
              aria-label="Close preview"
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                width: 36,
                height: 36,
                borderRadius: 18,
                background: "rgba(255,255,255,0.9)",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              }}
            >
              ×
            </button>

            {/* Preview content */}
            <div
              style={{
                padding: 24,
                borderTopLeftRadius: 12,
                borderTopRightRadius: 12,
                background: "#fff",
                boxShadow: "0 -2px 12px rgba(0,0,0,0.1)",
              }}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}          // add math
                rehypePlugins={[rehypeKatex]}                    // add katex
                components={mdComponents as any}
                children={typeof md === "string" ? md : ""}
              />
            </div>
          </div>
        </div>
      )}

      {/* Table picker popover */}
      {tableOpen && (
        <div
          role="dialog"
          aria-label="Insert table size"
          onClick={(e) => { if (e.target === e.currentTarget) setTableOpen(false); }}
          onKeyDown={(e) => { if (e.key === "Escape") setTableOpen(false); }}
          tabIndex={-1}
          style={{ position: "fixed", inset: 0, zIndex: 1100, background: "transparent" }}
        >
          <div
            style={{
              position: "absolute",
              top: Math.max(8, tablePos.top),
              left: Math.max(8, tablePos.left),
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              boxShadow: "0 12px 30px rgba(0,0,0,0.12)",
              padding: 10,
              userSelect: "none",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: "#444" }}>
                {tableHover.r > 0 && tableHover.c > 0 ? `${tableHover.r} × ${tableHover.c}` : "Pick size"}
              </div>
              <button
                type="button"
                onClick={() => setTableOpen(false)}
                aria-label="Close"
                style={{ border: "none", background: "transparent", fontSize: 18, cursor: "pointer", lineHeight: 1 }}
              >
                ×
              </button>
            </div>
            {/* Grid 8x8 */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 22px)", gap: 6 }}>
              {Array.from({ length: 8 }).map((_, r) =>
                Array.from({ length: 8 }).map((_, c) => {
                  const rr = r + 1, cc = c + 1;
                  const active = tableHover.r >= rr && tableHover.c >= cc;
                  return (
                    <div
                      key={`${r}-${c}`}
                      onMouseEnter={() => setTableHover({ r: rr, c: cc })}
                      onClick={() => insertTable(rr, cc)}
                      title={`${rr} × ${cc}`}
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 4,
                        border: "1px solid #e7e7eb",
                        background: active ? "#0ea5e9" : "#f8fafc",
                        boxShadow: active ? "inset 0 0 0 1px #0ea5e9" : "none",
                        cursor: "pointer",
                      }}
                    />
                  );
                })
              )}
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: "#666" }}>
              Click a size to insert a Markdown table
            </div>
          </div>
        </div>
      )}
    </div>
  );
}