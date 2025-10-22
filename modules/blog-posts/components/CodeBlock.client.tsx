"use client";
import React, { useEffect, useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

function CopyIcon({ color = "#e5e7eb" }: { color?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="9" width="11" height="11" rx="2" stroke={color} strokeWidth="1.6"/>
      <rect x="4" y="4" width="11" height="11" rx="2" stroke={color} strokeWidth="1.6" opacity="0.7"/>
    </svg>
  );
}

export default function CodeBlock({
  code,
  language = "plaintext",
  showLineNumbers = true,
}: {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1300);
    return () => clearTimeout(t);
  }, [copied]);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      // ignore
    }
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={onCopy}
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onPointerLeave={() => setPressed(false)}
        title={copied ? "Copied" : "Copy"}
        aria-label="Copy code"
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          width: 34,
          height: 30,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 8,
          background: copied
            ? "rgba(34,197,94,0.18)"
            : pressed
            ? "rgba(255,255,255,0.12)"
            : "rgba(255,255,255,0.06)",
          border: copied
            ? "1px solid rgba(34,197,94,0.45)"
            : "1px solid rgba(255,255,255,0.2)",
          color: copied ? "#22c55e" : "#e5e7eb",
          cursor: "pointer",
          transform: pressed ? "scale(0.97)" : "scale(1)",
          transition: "transform 100ms ease, background 120ms ease, color 120ms ease, border-color 120ms ease",
          zIndex: 1,
          outline: "none",
        }}
      >
        <CopyIcon color={copied ? "#22c55e" : "#e5e7eb"} />
      </button>

      {copied && (
        <div
          aria-live="polite"
          style={{
            position: "absolute",
            top: 10,
            right: 52,
            background: "rgba(34,197,94,0.12)",
            color: "#22c55e",
            border: "1px solid rgba(34,197,94,0.35)",
            padding: "3px 8px",
            borderRadius: 6,
            fontSize: 12,
            userSelect: "none",
            pointerEvents: "none",
          }}
        >
          Copied
        </div>
      )}

      <SyntaxHighlighter
        language={language}
        style={oneDark}
        PreTag="div"
        showLineNumbers={showLineNumbers}
        customStyle={{
          borderRadius: 8,
          margin: 0,
          background: "#0f172a",
          fontSize: 13,
        }}
        codeTagProps={{
          style: {
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
          },
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}