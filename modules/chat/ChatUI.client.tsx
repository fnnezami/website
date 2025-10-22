"use client";

import React, { useMemo, useRef, useState } from "react";
import { askOpenAI } from "./actions";

type ChatMsg = { role: "user" | "assistant"; content: string };

export default function ChatUI() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || pending) return;

    const next = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setPending(true);

    try {
      // Server action: includes system prompt + knowledge base automatically.
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

  return (
    <div style={{ width: "100%", maxWidth: 760 }}>
      <div
        ref={listRef}
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          padding: 12,
          minHeight: 260,
          maxHeight: 420,
          overflowY: "auto",
          background: "#fff",
        }}
      >
        {messages.length === 0 && (
          <div style={{ color: "#6b7280", fontSize: 14 }}>Ask me anything…</div>
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
                whiteSpace: "pre-wrap",
                padding: "8px 10px",
                borderRadius: 8,
                background: m.role === "user" ? "#0b66ff" : "#f3f4f6",
                color: m.role === "user" ? "#fff" : "#111827",
                border: m.role === "user" ? "none" : "1px solid #e5e7eb",
              }}
            >
              {m.content}
            </div>
          </div>
        ))}
        {pending && (
          <div style={{ color: "#6b7280", fontSize: 14, marginTop: 8 }}>Thinking…</div>
        )}
      </div>

      <form onSubmit={onSend} style={{ display: "flex", gap: 8, marginTop: 10 }}>
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
            padding: 10,
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            fontSize: 14,
          }}
        />
        <button
          type="submit"
          disabled={!canSend}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            background: canSend ? "#0b66ff" : "#93c5fd",
            color: "#fff",
            border: "none",
            cursor: canSend ? "pointer" : "default",
          }}
        >
          Send
        </button>
        <button
          type="button"
          onClick={() => setMessages([])}
          disabled={pending}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            background: "#f3f4f6",
            color: "#111827",
            border: "1px solid #e5e7eb",
            cursor: pending ? "default" : "pointer",
          }}
        >
          Reset
        </button>
      </form>
    </div>
  );
}