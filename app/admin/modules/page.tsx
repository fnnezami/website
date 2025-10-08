// app/admin/modules/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";

const Monaco = dynamic(() => import("@monaco-editor/react"), { ssr: false });

type ModuleRow = {
  id: string;
  kind: "page" | "block" | "floating" | "api";
  slug: string | null;
  title: string | null;
  enabled: boolean;
  config: any;
  updated_at?: string;
};

const KINDS = ["page", "block", "floating", "api"] as const;

function prettyErr(e: unknown) {
  if (e && typeof e === "object" && "message" in e) return (e as any).message || String(e);
  return String(e);
}

function SlimBtn(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "outline" }
) {
  const { variant = "ghost", className = "", ...rest } = props;
  const base = "text-sm px-3 py-1.5 rounded-md";
  const style =
    variant === "primary"
      ? "bg-black text-white hover:opacity-90"
      : variant === "outline"
      ? "border hover:bg-neutral-50"
      : "underline underline-offset-4";
  return <button className={`${base} ${style} ${className}`} {...rest} />;
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked ? "bg-green-600" : "bg-gray-300"
      }`}
      role="switch"
      aria-checked={checked}
      title={checked ? "Disable" : "Enable"}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
          checked ? "translate-x-5" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function langFor(file: string) {
  if (!file) return "typescript";
  const lower = file.toLowerCase();
  if (lower.endsWith(".js") || lower.endsWith(".jsx")) return "javascript";
  return "typescript";
}

export default function AdminModulesPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ModuleRow[]>([]);
  const [error, setError] = useState("");

  // module editor state
  const [selected, setSelected] = useState<string>("");
  const [form, setForm] = useState<Partial<ModuleRow> & { configText: string }>({
    id: "",
    kind: "floating",
    slug: "",
    title: "",
    enabled: true,
    configText: "{\n  \n}",
  });

  // Block types drawer/editor
  const [blocksOpen, setBlocksOpen] = useState(false);
  const [blockFiles, setBlockFiles] = useState<string[]>([]);
  const [activeBlockFile, setActiveBlockFile] = useState<string>("");
  const [activeBlockCode, setActiveBlockCode] = useState<string>("");
  const [blockMsg, setBlockMsg] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/admin/modules/list", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok || j?.ok === false) throw new Error(j?.error || `List failed (${r.status})`);
      setRows(Array.isArray(j.modules) ? j.modules : []);
    } catch (e) {
      setError(prettyErr(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  function newModule() {
    setSelected("");
    setForm({
      id: "",
      kind: "floating",
      slug: "",
      title: "",
      enabled: true,
      configText: "{\n  \n}",
    });
  }

  async function onCreate() {
    try {
      setError("");
      const payload: any = {
        id: (form.id || "").trim(),
        kind: form.kind,
        title: (form.title || "").trim() || null,
        enabled: !!form.enabled,
      };
      if (!payload.id) throw new Error("Module id is required.");
      if (payload.kind === "page") {
        payload.slug = (form.slug || "").trim();
        if (!payload.slug) throw new Error("Page modules require a slug.");
      }
      // STRICT JSON
      try {
        payload.config = form.configText?.trim() ? JSON.parse(form.configText) : {};
      } catch {
        throw new Error("Config JSON is invalid.");
      }
      const r = await fetch("/api/modules/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok || j?.ok === false) throw new Error(j?.error || `Create failed (${r.status})`);
      await load();
      setSelected(payload.id);
      onEditSelect(payload.id);
    } catch (e) {
      setError(prettyErr(e));
    }
  }

  function onEditSelect(id: string) {
    setSelected(id);
    const row = rows.find((r) => r.id === id);
    if (!row) {
      return newModule();
    }
    setForm({
      id: row.id,
      kind: row.kind,
      slug: row.slug || "",
      title: row.title || "",
      enabled: !!row.enabled,
      configText: JSON.stringify(row.config || {}, null, 2),
    });
  }

  async function onSave() {
    try {
      if (!form.id) throw new Error("No module selected.");
      const payload: any = {
        id: form.id,
        kind: form.kind,
        title: form.title?.trim() || null,
        enabled: !!form.enabled,
      };
      if (form.kind === "page") {
        payload.slug = (form.slug || "").trim();
        if (!payload.slug) throw new Error("Page modules require a slug.");
      }
      // STRICT JSON
      try {
        payload.config = form.configText?.trim() ? JSON.parse(form.configText) : {};
      } catch {
        throw new Error("Config JSON is invalid.");
      }
      const r = await fetch("/api/modules/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok || j?.ok === false) throw new Error(j?.error || `Save failed (${r.status})`);
      await load();
      setSelected(payload.id);
      onEditSelect(payload.id);
    } catch (e) {
      setError(prettyErr(e));
    }
  }

  async function onToggleEnabled(row: ModuleRow, next: boolean) {
    try {
      const payload = {
        id: row.id,
        kind: row.kind,
        slug: row.slug,
        title: row.title,
        enabled: next,
        config: row.config || {},
      };
      const r = await fetch("/api/modules/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok || j?.ok === false) throw new Error(j?.error || `Toggle failed (${r.status})`);
      await load();
    } catch (e) {
      setError(prettyErr(e));
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this module?")) return;
    try {
      const r = await fetch("/api/admin/modules/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const j = await r.json();
      if (!r.ok || j?.ok === false) throw new Error(j?.error || `Delete failed (${r.status})`);
      await load();
      if (selected === id) newModule();
    } catch (e) {
      setError(prettyErr(e));
    }
  }

  // Blocks drawer
  async function openBlocks() {
    setBlocksOpen(true);
    setBlockMsg("");
    setActiveBlockFile("");
    setActiveBlockCode("");
    try {
      const r = await fetch("/api/admin/code/blocks/list", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok || j?.ok === false) throw new Error(j?.error || `List failed (${r.status})`);
      setBlockFiles(Array.isArray(j.files) ? j.files : []);
    } catch (e) {
      setBlockMsg(prettyErr(e));
    }
  }

  async function loadBlock(file: string) {
    setActiveBlockFile(file);
    setActiveBlockCode("// loading…");
    setBlockMsg("");
    try {
      const r = await fetch("/api/admin/code/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file }),
      });
      const j = await r.json();
      if (!r.ok || j?.ok === false) throw new Error(j?.error || `Read failed (${r.status})`);
      setActiveBlockCode(String(j.code || ""));
    } catch (e) {
      setBlockMsg(prettyErr(e));
    }
  }

  async function saveBlock() {
    if (!activeBlockFile) return;
    setBlockMsg("");
    try {
      const r = await fetch("/api/admin/code/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: activeBlockFile, code: activeBlockCode }),
      });
      const j = await r.json();
      if (!r.ok || j?.ok === false) throw new Error(j?.error || `Save failed (${r.status})`);
      setBlockMsg("Saved.");
    } catch (e) {
      setBlockMsg(prettyErr(e));
    }
  }

  const sorted = useMemo(() => [...rows].sort((a, b) => a.id.localeCompare(b.id)), [rows]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-semibold">Modules</h1>
        <div className="flex gap-3">
          <SlimBtn onClick={openBlocks} variant="outline">
            Block Types
          </SlimBtn>
          <SlimBtn onClick={newModule} variant="primary">
            New Module
          </SlimBtn>
          <SlimBtn onClick={load}>Refresh</SlimBtn>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {/* Layout: list left, editor right (wider) */}
      <div className="grid gap-6 md:grid-cols-[1fr_1.4fr]">
        {/* Left list */}
        <div className="rounded-2xl border bg-white p-4">
          <div className="font-medium mb-3">Registered modules</div>
          {loading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : sorted.length === 0 ? (
            <p className="text-sm text-gray-500">No modules yet.</p>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 pr-3">ID</th>
                    <th className="py-2 pr-3">Kind</th>
                    <th className="py-2 pr-3">Slug</th>
                    <th className="py-2 pr-3">Title</th>
                    <th className="py-2 pr-3">Enabled</th>
                    <th className="py-2 pr-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((m) => (
                    <tr key={m.id} className="border-b last:border-0">
                      <td className="py-2 pr-3">
                        <button
                          className={`underline underline-offset-4 ${selected === m.id ? "font-semibold" : ""}`}
                          onClick={() => onEditSelect(m.id)}
                        >
                          {m.id}
                        </button>
                      </td>
                      <td className="py-2 pr-3">{m.kind}</td>
                      <td className="py-2 pr-3">{m.slug || "—"}</td>
                      <td className="py-2 pr-3">{m.title || "—"}</td>
                      <td className="py-2 pr-3">
                        <Toggle checked={!!m.enabled} onChange={(v) => onToggleEnabled(m, v)} />
                      </td>
                      <td className="py-2 pr-3">
                        <button
                          onClick={() => onDelete(m.id)}
                          className="text-xs text-red-600 underline underline-offset-4"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right editor with Monaco (JSON) */}
        <div className="rounded-2xl border bg-white p-4">
          <div className="font-medium mb-3">{selected ? "Edit module" : "Create module"}</div>

          <div className="grid gap-3">
            <label className="block">
              <span className="text-xs">ID</span>
              <input
                className="w-full border rounded-md p-2 text-sm"
                value={form.id || ""}
                onChange={(e) => setForm((s) => ({ ...s, id: e.target.value }))}
                placeholder="assistant, contact-page, theme-editor"
                disabled={!!selected}
              />
            </label>

            <label className="block">
              <span className="text-xs">Kind</span>
              <select
                className="w-full border rounded-md p-2 text-sm"
                value={form.kind}
                onChange={(e) => setForm((s) => ({ ...s, kind: e.target.value as any }))}
                disabled={!!selected}
              >
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>

            {form.kind === "page" && (
              <label className="block">
                <span className="text-xs">Slug (required for pages)</span>
                <input
                  className="w-full border rounded-md p-2 text-sm"
                  value={form.slug || ""}
                  onChange={(e) => setForm((s) => ({ ...s, slug: e.target.value }))}
                  placeholder="contact, appointments"
                />
              </label>
            )}

            <label className="block">
              <span className="text-xs">Title</span>
              <input
                className="w-full border rounded-md p-2 text-sm"
                value={form.title || ""}
                onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
                placeholder="Visible title (optional)"
              />
            </label>

            <label className="inline-flex items-center gap-2 text-sm">
              <Toggle checked={!!form.enabled} onChange={(v) => setForm((s) => ({ ...s, enabled: v }))} />
              <span>Enabled</span>
            </label>

            <div>
              <div className="text-xs mb-1">Config (JSON)</div>
              <div className="ring-1 ring-slate-200 rounded-md overflow-hidden">
                <Monaco
                  height="320px"
                  defaultLanguage="json"
                  value={form.configText}
                  onChange={(v) => setForm((s) => ({ ...s, configText: v ?? "" }))}
                  options={{
                    fontSize: 12,
                    minimap: { enabled: false },
                    wordWrap: "on",
                    automaticLayout: true,
                    formatOnPaste: true,
                    formatOnType: true,
                  }}
                />
              </div>
            </div>

            <div className="flex gap-2">
              {selected ? (
                <>
                  <SlimBtn onClick={onSave} variant="primary">
                    Save changes
                  </SlimBtn>
                  <SlimBtn onClick={newModule} variant="outline">
                    New
                  </SlimBtn>
                </>
              ) : (
                <SlimBtn onClick={onCreate} variant="primary">
                  Create module
                </SlimBtn>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Drawer: Block Types browser/editor */}
      {blocksOpen && (
        <div className="fixed inset-0 z-50 bg-black/30 flex">
          <div className="ml-auto h-full w-full max-w-3xl bg-white shadow-xl p-5 overflow-auto">
            <div className="flex items-center justify-between">
              <div className="font-medium text-lg">Block Types</div>
              <button onClick={() => setBlocksOpen(false)} className="text-sm opacity-70 hover:opacity-100">
                Close
              </button>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
              {/* file list */}
              <div className="rounded-2xl border bg-white p-3">
                <div className="text-sm font-medium mb-2">Files in /modules</div>
                {blockFiles.length === 0 ? (
                  <p className="text-xs text-gray-500">No files found.</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {blockFiles.map((f) => (
                      <li key={f}>
                        <button className="underline underline-offset-4" onClick={() => loadBlock(f)}>
                          {f.replace("/modules/", "")}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-3 text-xs text-gray-600">
                  Create new block files from your existing “New Block Type” flow if needed.
                </div>
              </div>

              {/* Monaco TS/JS editor */}
              <div className="rounded-2xl border bg-white p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">{activeBlockFile || "Select a file"}</div>
                  {activeBlockFile && (
                    <SlimBtn onClick={saveBlock} variant="primary">
                      Save
                    </SlimBtn>
                  )}
                </div>

                <div className="mt-2 ring-1 ring-slate-200 rounded-md overflow-hidden">
                  <Monaco
                    height="520px"
                    defaultLanguage={langFor(activeBlockFile)}
                    path={activeBlockFile || "untitled.tsx"}
                    value={activeBlockCode}
                    onChange={(v) => setActiveBlockCode(v ?? "")}
                    options={{
                      fontSize: 12,
                      minimap: { enabled: false },
                      wordWrap: "on",
                      automaticLayout: true,
                      formatOnPaste: true,
                      formatOnType: true,
                    }}
                  />
                </div>

                {blockMsg && <div className="mt-2 text-xs rounded border bg-neutral-50 p-2">{blockMsg}</div>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
