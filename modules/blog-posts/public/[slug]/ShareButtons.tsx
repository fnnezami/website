"use client";
import React, { useState } from "react";

export default function ShareButtons({
  title,
  slug,
  excerpt,
  shareSettings,
}: {
  title: string;
  slug: string;
  excerpt?: string | null;
  shareSettings?: Record<string, boolean>;
}) {
  const canX = !!(shareSettings?.x || shareSettings?.twitter);
  const canLinkedIn = !!shareSettings?.linkedin;
  const canCopy = !!shareSettings?.copy_link;
  const canEmbed = !!shareSettings?.embed;

  const [copied, setCopied] = useState(false);
  const [embedOpen, setEmbedOpen] = useState(false);

  if (!canX && !canLinkedIn && !canCopy && !canEmbed) return null;

  function openPopup(url: string, name = "share") {
    const w = 640;
    const h = 480;
    const left = Math.max(0, window.screenX + (window.innerWidth - w) / 2);
    const top = Math.max(0, window.screenY + (window.innerHeight - h) / 2);
    window.open(url, name, `noopener,noreferrer,width=${w},height=${h},left=${left},top=${top}`);
  }

  function buildTweetText() {
    const pageUrl = window.location.href;
    const maxTotal = 240; // conservative
    const urlLen = pageUrl.length + 1;
    const allowed = Math.max(60, maxTotal - urlLen);
    const head = title || "";
    const body = excerpt ? ` — ${excerpt.replace(/\s+/g, " ").trim()}` : "";
    let text = (head + body).trim();
    if (text.length > allowed) text = text.slice(0, allowed - 1).trim() + "…";
    return text;
  }

  function onShareX(e: React.MouseEvent) {
    e.preventDefault();
    const pageUrl = window.location.href;
    const text = buildTweetText();
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(pageUrl)}`;
    openPopup(url, "xshare");
  }

  function onShareLinkedIn(e: React.MouseEvent) {
    e.preventDefault();
    const pageUrl = window.location.href;
    const titleText = title || "";
    const summary = excerpt ? excerpt.replace(/\s+/g, " ").trim() : "";
    const source = window.location.hostname || "";
    const url = `https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(
      pageUrl
    )}&title=${encodeURIComponent(titleText)}&summary=${encodeURIComponent(summary)}&source=${encodeURIComponent(
      source
    )}`;
    openPopup(url, "lnshare");
  }

  async function onCopyLink(e: React.MouseEvent) {
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // fallback: select and prompt
      const t = document.createElement("textarea");
      t.value = window.location.href;
      document.body.appendChild(t);
      t.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch {}
      t.remove();
    }
  }

  function onOpenEmbed(e: React.MouseEvent) {
    e.preventDefault();
    setEmbedOpen(true);
  }

  function onCopyEmbed() {
    const embed = `<iframe src="${window.location.href}" width="800" height="450" style="border:0;" loading="lazy"></iframe>`;
    navigator.clipboard?.writeText(embed).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => {}
    );
  }

  const btnStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid #e6e6e6",
    background: "#fff",
    cursor: "pointer",
    fontSize: 14,
    color: "#111",
  };

  return (
    <>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        {canX && (
          <button aria-label="Share on X" style={btnStyle} onClick={onShareX}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
              <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53A4.48 4.48 0 0 0 22.43 1s-1.93.82-2.75 1.09A4.48 4.48 0 0 0 16.5 0c-2.5 0-4.5 2.28-3.9 4.66A12.94 12.94 0 0 1 1.64 1.15 4.47 4.47 0 0 0 3 7.86 4.41 4.41 0 0 1 .88 7.23v.05A4.49 4.49 0 0 0 4.48 12.9a4.5 4.5 0 0 1-2 .08 4.5 4.5 0 0 0 4.2 3.12A9 9 0 0 1 1 19.54a12.7 12.7 0 0 0 6.92 2.03c8.3 0 12.84-7.03 12.84-13.13 0-.2 0-.39-.01-.58A9.22 9.22 0 0 0 23 3z" fill="#1DA1F2" />
            </svg>
            Share on X
          </button>
        )}

        {canLinkedIn && (
          <button aria-label="Share on LinkedIn" style={btnStyle} onClick={onShareLinkedIn}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
              <path d="M4.98 3.5C4.98 4.88 3.87 6 2.5 6S0 4.88 0 3.5 1.11 1 2.48 1s2.5 1.11 2.5 2.5zM0 8h5v16H0zM7.5 8h4.8v2.2h.1c.7-1.3 2.5-2.7 5.2-2.7C24 7.5 24 13 24 17.8V24h-5v-6.4c0-1.5 0-3.5-2.1-3.5-2.1 0-2.4 1.6-2.4 3.4V24h-5V8z" fill="#0A66C2" />
            </svg>
            Share on LinkedIn
          </button>
        )}

        {canCopy && (
          <button aria-label="Copy link" style={btnStyle} onClick={onCopyLink}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
              <path d="M3.9 12.9a3 3 0 0 1 0-4.2l3-3a3 3 0 0 1 4.2 4.2l-1.2 1.2" stroke="#333" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M20.1 11.1a3 3 0 0 1 0 4.2l-3 3a3 3 0 0 1-4.2-4.2l1.2-1.2" stroke="#333" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {copied ? "Copied" : "Copy link"}
          </button>
        )}

        {canEmbed && (
          <button aria-label="Embed" style={btnStyle} onClick={onOpenEmbed}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
              <path d="M8.3 17.3 3 12l5.3-5.3M15.7 6.7 21 12l-5.3 5.3" stroke="#333" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Embed
          </button>
        )}
      </div>

      {embedOpen && (
        <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} onClick={() => setEmbedOpen(false)} />
          <div style={{ background: "#fff", borderRadius: 10, padding: 18, width: "min(900px, 96%)", maxHeight: "90vh", overflow: "auto", zIndex: 10000 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <strong>Embed</strong>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { onCopyEmbed(); }} style={btnStyle}>Copy embed</button>
                <button onClick={() => setEmbedOpen(false)} style={btnStyle}>Close</button>
              </div>
            </div>

            <div style={{ marginBottom: 12, fontSize: 13, color: "#444" }}>Paste this HTML into your site to embed the post:</div>
            <pre style={{ background: "#f7f7fb", padding: 12, borderRadius: 8, overflow: "auto", fontSize: 13 }}>
{`<iframe src="${typeof window !== "undefined" ? window.location.href : ""}" width="800" height="450" style="border:0;" loading="lazy"></iframe>`}
            </pre>
          </div>
        </div>
      )}
    </>
  );
}