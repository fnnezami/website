"use client";
import React, { useEffect, useState } from "react";

type Msg = { id: string; from: "user" | "ai"; text: string };

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [cfgLoaded, setCfgLoaded] = useState(false);
  const [welcome, setWelcome] = useState("Hi!");
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);

  useEffect(() => {
    let mounted = true;
    async function loadCfg() {
      try {
        const res = await fetch("/api/admin/modules/chat/config", { cache: "no-store" });
        if (!res.ok) return;
        const j = await res.json();
        if (!mounted) return;
        const cfg = j?.config || {};
        setWelcome(cfg.welcome || welcome);
        setApiKey(cfg.apiKey || null);
      } catch {
        // ignore
      } finally {
        if (mounted) setCfgLoaded(true);
      }
    }
    loadCfg();
    return () => { mounted = false; };
  }, []);

  function openChat() {
    setOpen(true);
    if (messages.length === 0) {
      const id = String(Date.now());
      setMessages([{ id, from: "ai", text: welcome }]);
    }
  }

  function closeChat() {
    setOpen(false);
  }

  function pushMessage(from: Msg["from"], text: string) {
    setMessages((m) => [...m, { id: String(Date.now()) + Math.random().toString(36).slice(2, 8), from, text }]);
  }

  async function send() {
    if (!input.trim()) return;
    const txt = input.trim();
    pushMessage("user", txt);
    setInput("");

    // mock AI response: echo with delay; if apiKey present you can replace with a real call
    pushMessage("ai", "…thinking…");
    setTimeout(() => {
      setMessages((m) => {
        // remove the last "…thinking…" and append a reply
        const withoutThinking = m.filter((x) => x.text !== "…thinking…");
        return [...withoutThinking, { id: String(Date.now()), from: "ai", text: `AI: I heard "${txt}". (mock reply)` }];
      });
    }, 900);
  }

  // simple styles
  const btnStyle: React.CSSProperties = { position: "fixed", right: 20, bottom: 20, zIndex: 9999 };
  const widgetStyle: React.CSSProperties = { position: "fixed", right: 20, bottom: 80, width: 360, maxWidth: "calc(100% - 40px)", zIndex: 9999, boxShadow: "0 10px 30px rgba(2,6,23,0.2)" };

  return (
    <>
      {!open && (
        <div style={btnStyle}>
          <button onClick={openChat} title="Open chat" style={{ background: "#0b66ff", color: "#fff", padding: "10px 14px", borderRadius: 999, border: "none", cursor: "pointer" }}>
            Chat
          </button>
        </div>
      )}

      {open && (
        <div style={widgetStyle}>
          <div style={{ background: "#fff", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ padding: 12, background: "#0b66ff", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 600 }}>Chat</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={closeChat} style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer" }}>Close</button>
              </div>
            </div>

            <div style={{ maxHeight: 360, overflow: "auto", padding: 12, background: "#f7f7fb" }}>
              {messages.map((m) => (
                <div key={m.id} style={{ marginBottom: 10, display: "flex", justifyContent: m.from === "ai" ? "flex-start" : "flex-end" }}>
                  <div style={{ background: m.from === "ai" ? "#fff" : "#0b66ff", color: m.from === "ai" ? "#111" : "#fff", padding: "8px 10px", borderRadius: 8, maxWidth: "80%" }}>
                    {m.text}
                  </div>
                </div>
              ))}
              {messages.length === 0 && cfgLoaded && <div style={{ color: "#666" }}>No messages yet.</div>}
            </div>

            <div style={{ display: "flex", gap: 8, padding: 10, borderTop: "1px solid #eee" }}>
              <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} placeholder="Write a message..." style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid #e6e6e6" }} />
              <button onClick={send} style={{ background: "#0b66ff", color: "#fff", padding: "8px 12px", borderRadius: 8, border: "none" }}>Send</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}