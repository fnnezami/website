"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { askOpenAI } from "./actions";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
// If Next.js complains about global CSS here, move this import to app/layout.tsx
import "katex/dist/katex.min.css";
import CodeBlock from "../blog-posts/components/CodeBlock.client";

type ChatMsg = { role: "user" | "assistant"; content: string };

export default function ChatUI() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);

  const listRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Explicit resizable size (instead of CSS resize so it works reliably)
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 560, h: 460 });

  function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n));
  }

  function startResize(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    const startX =
      "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const startY =
      "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    const startW = size.w;
    const startH = size.h;

    function onMove(ev: MouseEvent | TouchEvent) {
      const cx =
        ev instanceof TouchEvent ? ev.touches[0].clientX : (ev as MouseEvent).clientX;
      const cy =
        ev instanceof TouchEvent ? ev.touches[0].clientY : (ev as MouseEvent).clientY;
      const dx = cx - startX;
      const dy = cy - startY;
      const maxW = Math.min(window.innerWidth - 32, 900);
      const maxH = Math.min(window.innerHeight - 32, 900);
      setSize({
        w: clamp(startW + dx, 320, maxW),
        h: clamp(startH + dy, 260, maxH),
      });
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove as any);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove as any);
      window.removeEventListener("touchend", onUp);
    }

    window.addEventListener("mousemove", onMove as any, { passive: false });
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove as any, { passive: false });
    window.addEventListener("touchend", onUp);
  }

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || pending) return;

    const next: ChatMsg[] = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setPending(true);

    try {
      const reply = await askOpenAI(next);
      setMessages((m) => [...m, { role: "assistant", content: reply || "(no reply)" }]);
    } catch (err: any) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Error: " + (err?.message || "Failed to get a response.") },
      ]);
    } finally {
      setPending(false);
      queueMicrotask(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
      });
    }
  }

  const canSend = useMemo(() => input.trim().length > 0 && !pending, [input, pending]);

  useEffect(() => {
    // Keep list scrolled when messages change
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  const mdComponents: any = {
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
    table: (props: any) => (
      <table
        {...props}
        style={{ width: "100%", borderCollapse: "collapse", margin: "0.75em 0", fontSize: 14 }}
      />
    ),
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
    a: (props: any) => (
      <a {...props} target="_blank" rel="noreferrer" style={{ color: "var(--primary, #0b66ff)", textDecoration: "underline" }} />
    ),
    // eslint-disable-next-line @next/next/no-img-element
    img: (props: any) => {
      const { src, alt, ...rest } = props ?? {};
      const s = typeof src === "string" ? src.trim() : "";
      if (!s) return null;
      return <img src={s} alt={typeof alt === "string" ? alt : ""} style={{ maxWidth: "100%", height: "auto", borderRadius: 6 }} {...rest} />;
    },
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",

        width: size.w,
        height: size.h,
        minWidth: 320,
        minHeight: 260,
        maxWidth: "96vw",
        maxHeight: "90vh",
        overflow: "hidden",

        // Theme-friendly styling with clear contrast
        background: "var(--surface, #ffffff)",
        color: "var(--text-color, #0f172a)",
        border: "1px solid var(--border-color, #e5e7eb)",
        borderRadius: 16,
        boxShadow: "0 14px 40px rgba(0,0,0,.14)",
      }}
    >
      {/* Header with nicer icon */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          height: 48,
          padding: "0 12px",
          borderBottom: "1px solid var(--border-color, #e5e7eb)",
          background:
            "var(--surface-2, linear-gradient(180deg, #f9fafb 0%, #ffffff 100%))",
        }}
      >
        <svg
          aria-hidden
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          style={{ flex: "0 0 auto" }}
        >
          <path
            d="M12 3c4.418 0 8 2.91 8 6.5 0 2.12-1.307 3.99-3.313 5.1l.63 3.15a1 1 0 0 1-1.47 1.07L12 17.75l-3.847 1.07a1 1 0 0 1-1.47-1.07l.63-3.15C5.307 13.49 4 11.62 4 9.5 4 5.91 7.582 3 12 3Z"
            fill="var(--primary, #0b66ff)"
            opacity="0.12"
          />
          <circle cx="9.5" cy="9.5" r="1.2" fill="var(--primary, #0b66ff)" />
          <circle cx="14.5" cy="9.5" r="1.2" fill="var(--primary, #0b66ff)" />
          <path
            d="M8.8 12.8c.9.9 2.1 1.4 3.2 1.4s2.3-.5 3.2-1.4"
            stroke="var(--primary, #0b66ff)"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
        <div style={{ fontWeight: 700, fontSize: 15 }}>Chat</div>
        <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted, #6b7280)" }}>
          {pending ? "Thinking…" : "Online"}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={listRef}
        style={{
          flex: 1,
          padding: 12,
          overflowY: "auto",
          background: "var(--surface-2, #fafafa)",
        }}
      >
        {messages.length === 0 && (
          <div style={{ color: "var(--muted, #6b7280)", fontSize: 14 }}>
            Ask me anything…
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              margin: "8px 0",
              justifyContent: m.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            <div
              style={{
                maxWidth: "80%",
                padding: "10px 12px",
                borderRadius: 12,
                background:
                  m.role === "user"
                    ? "var(--primary, #0b66ff)"
                    : "var(--bubble-bg, #f6f7fb)",
                color: m.role === "user" ? "#fff" : "var(--text-color, #111827)",
                border:
                  m.role === "user"
                    ? "1px solid rgba(255,255,255,.12)"
                    : "1px solid var(--border-color, #e5e7eb)",
                boxShadow:
                  m.role === "user"
                    ? "inset 0 0 0 1px rgba(255,255,255,.06)"
                    : "none",
                // allow markdown elements to layout nicely
                whiteSpace: "normal",
                lineHeight: 1.55,
              }}
            >
              {m.role === "assistant" ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                  components={mdComponents}
                >
                  {m.content}
                </ReactMarkdown>
              ) : (
                <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>
              )}
            </div>
          </div>
        ))}
        {pending && (
          <div style={{ color: "var(--muted, #6b7280)", fontSize: 14, marginTop: 8 }}>
            Thinking…
          </div>
        )}
      </div>

      {/* Composer */}
      <form
        onSubmit={onSend}
        style={{
          display: "flex",
          gap: 8,
          padding: 10,
          background: "var(--surface, #ffffff)",
          borderTop: "1px solid var(--border-color, #e5e7eb)",
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message…"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              setInput((s) => s + "\n");
            }
          }}
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid var(--border-color, #e5e7eb)",
            background: "var(--input-bg, #fff)",
            color: "var(--text-color, #0f172a)",
            fontSize: 14,
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={!canSend}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            background: canSend ? "var(--primary, #0b66ff)" : "var(--primary-weak, #93c5fd)",
            color: "#fff",
            border: "none",
            cursor: canSend ? "pointer" : "default",
            fontWeight: 600,
          }}
        >
          Send
        </button>
      </form>

      {/* Resizer handle */}
      <div
        onMouseDown={startResize}
        onTouchStart={startResize}
        style={{
          position: "absolute",
          right: 6,
          bottom: 6,
          width: 16,
          height: 16,
          borderRadius: 4,
          background:
            "conic-gradient(from 45deg, transparent 0 25%, rgba(0,0,0,.12) 0 50%, transparent 0 75%, rgba(0,0,0,.18) 0)",
          cursor: "se-resize",
          opacity: 0.8,
        }}
        aria-label="Resize chat"
        title="Resize"
      />
    </div>
  );
}