"use client";
import { useState, useEffect } from "react";

export default function SetupForm({ needsSetup }: { needsSetup: boolean }) {
  const [openai, setOpenai] = useState("");
  const [n8n, setN8n] = useState("");
  const [gist, setGist] = useState("");

  useEffect(() => {
    if (!needsSetup) window.location.href = "/admin"; // already set
  }, [needsSetup]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/admin/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ OPENAI_API_KEY: openai, N8N_WEBHOOK_URL: n8n, GIST_RAW_URL: gist }),
    });
    const j = await r.json();
    if (!r.ok || j?.ok === false) {
      alert(j?.error || "Setup failed");
      return;
    }
    window.location.href = "/admin";
  }

  return (
    <div className="mx-auto max-w-xl p-6 space-y-4">
      <h1 className="text-xl font-semibold">Initial setup</h1>
      <p className="text-sm text-gray-600">Sign-in succeeded. Complete initial config:</p>
      <form className="space-y-3" onSubmit={onSubmit}>
        <label className="block">
          <span className="text-sm">OpenAI API Key</span>
          <input className="w-full border rounded-md p-2" value={openai} onChange={e => setOpenai(e.target.value)} placeholder="sk-..." />
        </label>
        <label className="block">
          <span className="text-sm">n8n Webhook URL</span>
          <input className="w-full border rounded-md p-2" value={n8n} onChange={e => setN8n(e.target.value)} placeholder="https://..." />
        </label>
        <label className="block">
          <span className="text-sm">Gist RAW URL</span>
          <input className="w-full border rounded-md p-2" value={gist} onChange={e => setGist(e.target.value)} placeholder="https://gist.githubusercontent.com/.../raw/resume.json" />
        </label>
        <button className="rounded-md bg-black text-white px-4 py-2">Save and continue</button>
      </form>
    </div>
  );
}
