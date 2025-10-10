"use client";
import React, { useEffect, useState } from "react";

export default function ChatAdmin() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [welcome, setWelcome] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await fetch("/api/admin/modules/chat/config", { cache: "no-store" });
        if (!res.ok) throw new Error(await res.text().catch(() => String(res.status)));
        const j = await res.json();
        if (!mounted) return;
        const cfg = j?.config || {};
        setWelcome(cfg.welcome || "");
        setApiKey(cfg.apiKey || "");
      } catch (err: any) {
        setMessage(String(err?.message || err));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/modules/chat/config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ config: { welcome: String(welcome), apiKey: String(apiKey) } }),
      });
      const j = await res.json();
      if (!res.ok || j?.ok === false) throw new Error(j?.error || "save failed");
      setMessage("Saved.");
    } catch (err: any) {
      setMessage(String(err?.message || err));
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  }

  return (
    <div style={{ padding: 12, maxWidth: 760 }}>
      <h2 style={{ margin: "0 0 8px 0" }}>Floating Chat — Admin</h2>
      <p style={{ margin: "0 0 12px 0", color: "#555" }}>Set the greeting users see and an optional API key.</p>

      {loading ? (
        <div>Loading…</div>
      ) : (
        <>
          <label style={{ display: "block", fontSize: 13, marginBottom: 6 }}>Welcome message</label>
          <textarea value={welcome} onChange={(e) => setWelcome(e.target.value)} rows={3} style={{ width: "100%", padding: 8, fontSize: 14, borderRadius: 6, border: "1px solid #e6e6e6", marginBottom: 12 }} />

          <label style={{ display: "block", fontSize: 13, marginBottom: 6 }}>API key (optional)</label>
          <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} type="password" placeholder="sk-..." style={{ width: "100%", padding: 8, fontSize: 14, borderRadius: 6, border: "1px solid #e6e6e6", marginBottom: 12 }} />

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={save} disabled={saving} style={{ padding: "8px 12px", borderRadius: 6, background: "#0b66ff", color: "#fff", border: "none" }}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button onClick={() => { setWelcome(""); setApiKey(""); }} style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #e6e6e6", background: "#fff" }}>
              Reset
            </button>
          </div>

          {message && <div style={{ marginTop: 12, color: message === "Saved." ? "green" : "crimson" }}>{message}</div>}
        </>
      )}
    </div>
  );
}