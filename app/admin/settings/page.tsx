"use client";

import React, { useState } from "react";

export default function AdminSettingsPage() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onReprovision() {
    if (!confirm("Re-run provisioning will reapply DB foundation SQL (safe/idempotent) and may change DB policies. Continue?")) return;
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch("/api/admin/setup/reprovision", { method: "POST", cache: "no-store" });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || `status ${res.status}`);
      setMsg(j?.message || "Reprovision completed");
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <section className="mt-8 rounded-lg border bg-white p-4">
        <h2 className="font-medium text-lg">Danger zone</h2>
        <p className="text-sm text-gray-600 mt-2">
          Re-run the provisioning flow to recreate core DB tables, RLS policies and module registry. This is idempotent but may affect existing policies and triggers.
        </p>

        <div className="mt-4 flex items-center gap-3">
          <button
            className="bg-red-600 text-white px-4 py-2 rounded-md hover:opacity-90"
            onClick={onReprovision}
            disabled={busy}
            title="Reapply provisioning SQL"
          >
            {busy ? "Running…" : "Re-run provision"}
          </button>
          <div className="text-sm text-gray-600">
            Use with caution.
          </div>
        </div>

        {msg && <div className="mt-3 rounded-md border border-green-100 bg-green-50 p-2 text-sm text-green-700">{msg}</div>}
        {err && <div className="mt-3 rounded-md border border-red-100 bg-red-50 p-2 text-sm text-red-700">{err}</div>}
      </section>
    </div>
  );
}