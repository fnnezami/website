// app/admin/modules/page.tsx
"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { loadManifestsWithRegistry } from "@/lib/modules";

const Monaco = dynamic(() => import("@monaco-editor/react"), { ssr: false });

type ModuleRow = {
  id: string;
  kind: "page" | "block" | "floating" | "api";
  slug: string | null;
  title: string | null;
  enabled: boolean;
  config: any;
  updated_at?: string;
  // new fields
  installed?: boolean;
  installed_at?: string | null;
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

  // Blocks drawer/editor
  const [blocksOpen, setBlocksOpen] = useState(false);
  const [blockFiles, setBlockFiles] = useState<string[]>([]);
  const [activeBlockFile, setActiveBlockFile] = useState<string>("");
  const [activeBlockCode, setActiveBlockCode] = useState<string>("");
  const [blockMsg, setBlockMsg] = useState("");

  // Logs modal
  const [logsOpen, setLogsOpen] = useState(false);
  const [logModule, setLogModule] = useState<string | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState("");

  // install-from-folder modal state
  const [installOpen, setInstallOpen] = useState(false);
  const [folderModules, setFolderModules] = useState<any[]>([]);
  const [folderLoading, setFolderLoading] = useState(false);
  const [folderError, setFolderError] = useState<string | null>(null);
  const [zipUploading, setZipUploading] = useState(false);
  const zipRef = useRef<HTMLInputElement | null>(null);

  // notification state
  const [notif, setNotif] = useState<{ id: string; kind?: "success" | "error" | "info"; text: string } | null>(null);
  const [installResult, setInstallResult] = useState<any | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      // request modules from DB; includeDisabled=1 so disabled modules still appear
      const res = await fetch("/api/modules/registry?includeDisabled=1", { cache: "no-store" });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `request failed (${res.status})`);
      }
      const all = await res.json();

      const rows: ModuleRow[] = (Array.isArray(all) ? all : []).map((m: any) => ({
        id: String(m.id ?? m.name ?? m.slug ?? ""),
        kind: (m.kind as ModuleRow["kind"]) || "page",
        slug: m.config?.pagePath || m.slug || null,
        title: m.name || m.title || null,
        enabled: m.enabled !== false,
        config: m.config || {},
        updated_at: m.updated_at || m._updated_at || null,
        // installed is optional in the DB; keep whatever value is present (truthy/falsey)
        installed: m.hasOwnProperty("installed") ? !!m.installed : false,
        installed_at: m.installed_at || m._installed_at || null,
      }));

      setRows(rows);
    } catch (err) {
      setError(prettyErr(err));
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
    // optimistic UI update
    setRows((r) => r.map((m) => (m.id === row.id ? { ...m, enabled: next } : m)));

    try {
      const r = await fetch("/api/admin/modules/set-enabled", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, enabled: next }),
      });
      const j = await r.json();
      if (!r.ok || j?.ok === false) throw new Error(j?.error || `Toggle failed (${r.status})`);
      // ensure fresh load to pick up any other changes
      await load();
    } catch (e) {
      // revert on error and show message
      setRows((r) => r.map((m) => (m.id === row.id ? { ...m, enabled: row.enabled } : m)));
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

  // New: install a module (run migrations)
  async function onInstall(moduleId: string) {
    if (!confirm(`Install module "${moduleId}"? This will run the module migrations.`)) return;
    setError("");
    try {
      const r = await fetch("/api/admin/modules/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleId }),
      });
      const j = await r.json();
      if (!r.ok || j?.ok === false) throw new Error(j?.error || `Install failed (${r.status})`);
      await load();
      alert("Install completed.");
    } catch (e) {
      setError(prettyErr(e));
    }
  }

  // New: view logs for a module
  async function openLogs(moduleId?: string) {
    setLogsOpen(true);
    setLogs([]);
    setLogsError("");
    setLogsLoading(true);
    setLogModule(moduleId || null);
    try {
      const url = moduleId ? `/api/admin/modules/logs?moduleId=${encodeURIComponent(moduleId)}` : `/api/admin/modules/logs`;
      const r = await fetch(url, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok || j?.ok === false) throw new Error(j?.error || `Logs failed (${r.status})`);
      setLogs(Array.isArray(j.logs) ? j.logs : []);
    } catch (e) {
      setLogsError(prettyErr(e));
    } finally {
      setLogsLoading(false);
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

  async function openInstallModal() {
    setInstallOpen(true);
    setFolderLoading(true);
    setFolderError(null);
    try {
      const r = await fetch("/api/admin/modules/folder-list", { cache: "no-store" });
      if (!r.ok) throw new Error(await r.text().catch(() => `status ${r.status}`));
      const j = await r.json();
      setFolderModules(Array.isArray(j) ? j : []);
    } catch (e) {
      setFolderError(prettyErr(e));
    } finally {
      setFolderLoading(false);
    }
  }

  async function installFromFolder(moduleId: string) {
    setFolderLoading(true);
    setFolderError(null);
    try {
      const res = await fetch("/api/admin/modules/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleId }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.error) throw new Error(j?.error || `install failed (${res.status})`);
      // show installer output (if any) and refresh listing
      setInstallResult({ moduleId, result: j });
      setNotif({ id: String(Date.now()), kind: "success", text: `Installed ${moduleId}` });
      await load();
      setInstallOpen(false);
    } catch (e) {
      setFolderError(prettyErr(e));
      setNotif({ id: String(Date.now()), kind: "error", text: `Install failed: ${prettyErr(e)}` });
      setInstallResult({ moduleId, error: prettyErr(e) });
    } finally {
      setFolderLoading(false);
    }
  }

  // upload zip -> call install-zip endpoint -> if zip endpoint didn't auto-run installer, call canonical installer with returned id
  async function installFromZipFile(file: File | null) {
    if (!file) return;
    setZipUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/admin/modules/install-zip", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok || j?.ok === false) throw new Error(j?.error || `upload failed (${r.status})`);

      const id = j?.id || j?.installer?.id || j?.installer?.result?.id || j?.installer?.manifest?.id;
      if (id) {
        const run = await fetch("/api/admin/modules/install", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ moduleId: id }),
        });
        const jr = await run.json().catch(() => ({}));
        // surface installer output (either from zip endpoint or canonical installer)
        const finalResult = { uploaded: j, installerRun: jr };
        setInstallResult({ moduleId: id, result: finalResult });
        if (!run.ok || jr?.error) {
          setNotif({ id: String(Date.now()), kind: "info", text: `Uploaded ${id} (installer returned warning)` });
        } else {
          setNotif({ id: String(Date.now()), kind: "success", text: `Installed ${id}` });
        }
      } else {
        setInstallResult({ uploaded: j });
        setNotif({ id: String(Date.now()), kind: "success", text: `Uploaded module (no id returned)` });
      }

      await load();
    } catch (e) {
      setError(prettyErr(e));
      setNotif({ id: String(Date.now()), kind: "error", text: `Upload failed: ${prettyErr(e)}` });
      setInstallResult({ error: prettyErr(e) });
    } finally {
      setZipUploading(false);
      if (zipRef.current) zipRef.current.value = "";
    }
  }

  // helper to dismiss install modal
  function closeInstallResult() {
    setInstallResult(null);
  }

  const sorted = useMemo(() => [...rows].sort((a, b) => a.id.localeCompare(b.id)), [rows]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 space-y-6">
      {/* Inline notification */}
      {notif && (
        <div
          style={{
            position: "fixed",
            right: 20,
            top: 20,
            zIndex: 99999,
            minWidth: 260,
            padding: 12,
            borderRadius: 8,
            background: notif.kind === "error" ? "#ffeeee" : notif.kind === "success" ? "#eafff1" : "#eef2ff",
            color: "#111",
            boxShadow: "0 6px 20px rgba(2,6,23,0.12)",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{notif.kind === "error" ? "Error" : notif.kind === "success" ? "Success" : "Info"}</div>
          <div style={{ fontSize: 13 }}>{notif.text}</div>
          <div style={{ marginTop: 8, textAlign: "right" }}>
            <button onClick={() => setNotif(null)} style={{ padding: "6px 10px", borderRadius: 6, border: "none", background: "#fff" }}>
              Dismiss
            </button>
          </div>
        </div>
      )}
      {/* Install result modal */}
      {installResult && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30">
          <div className="mt-16 w-full max-w-4xl bg-white rounded-lg shadow-lg p-4 overflow-auto" style={{ maxHeight: "75vh" }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-lg font-medium">Install result</div>
                <div className="text-sm text-gray-600">{installResult?.moduleId ? String(installResult.moduleId) : "result"}</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={closeInstallResult} className="text-sm px-3 py-1 border rounded">Close</button>
              </div>
            </div>

            <div className="text-sm">
              <div className="mb-2 font-medium">Raw result</div>
              <pre style={{ background: "#f7f7fb", padding: 12, borderRadius: 8, overflow: "auto" }}>{JSON.stringify(installResult, null, 2)}</pre>
            </div>
          </div>
        </div>
      )}

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
          <SlimBtn onClick={() => openLogs()} variant="ghost">
            View recent logs
          </SlimBtn>
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
                    <th className="py-2 pr-3">Installed</th>
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
                        {m.installed ? <span className="text-xs text-green-600">Yes</span> : <span className="text-xs text-gray-500">No</span>}
                      </td>
                      <td className="py-2 pr-3 flex gap-2 items-center">
                        <button onClick={() => openLogs(m.id)} className="text-xs text-slate-600 underline underline-offset-4">
                          Logs
                        </button>
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

          {/* New: single install area at bottom of module list */}
          <div className="mt-4 border-t pt-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Install modules</div>
                <div className="text-xs text-gray-500">Install from modules folder or upload a zip</div>
              </div>
              <div className="flex gap-2">
                <button onClick={openInstallModal} className="text-sm border rounded-md px-3 py-1.5">
                  Install from folder
                </button>
                <input ref={zipRef} type="file" accept=".zip" style={{ display: "none" }} onChange={(e) => installFromZipFile(e.target.files?.[0] ?? null)} />
                <button
                  onClick={() => zipRef.current?.click()}
                  className="text-sm border rounded-md px-3 py-1.5"
                  disabled={zipUploading}
                >
                  {zipUploading ? "Uploading…" : "Install from ZIP"}
                </button>
              </div>
            </div>
          </div>
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

      {/* Install from-folder modal */}
      {installOpen && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-start">
          <div className="ml-auto mt-12 h-[80vh] w-full max-w-3xl bg-white shadow-xl p-5 overflow-auto">
            <div className="flex items-center justify-between">
              <div className="font-medium text-lg">Modules in /modules folder</div>
              <button onClick={() => setInstallOpen(false)} className="text-sm opacity-70 hover:opacity-100">
                Close
              </button>
            </div>

            <div className="mt-4">
              {folderLoading ? (
                <p className="text-sm text-gray-500">Reading folder…</p>
              ) : folderError ? (
                <div className="text-sm text-red-600">{folderError}</div>
              ) : folderModules.length === 0 ? (
                <p className="text-sm text-gray-500">No module folders found.</p>
              ) : (
                <ul className="space-y-2">
                  {folderModules.map((m) => (
                    <li key={m.id} className="flex items-center justify-between border rounded p-3">
                      <div>
                        <div className="font-medium">{m.id}</div>
                        <div className="text-xs text-gray-600">{m.manifestPresent ? (m.manifest?.name || "Has manifest") : "No manifest"}</div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => installFromFolder(m.id)} className="text-sm border rounded-md px-3 py-1.5">
                          Install
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

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

      {/* Logs modal */}
      {logsOpen && (
        <div className="fixed inset-0 z-50 bg-black/30 flex">
          <div className="ml-auto h-full w-full max-w-3xl bg-white shadow-xl p-5 overflow-auto">
            <div className="flex items-center justify-between">
              <div className="font-medium text-lg">{logModule ? `Logs for ${logModule}` : "Recent module logs"}</div>
              <button
                onClick={() => {
                  setLogsOpen(false);
                  setLogModule(null);
                  setLogs([]);
                }}
                className="text-sm opacity-70 hover:opacity-100"
              >
                Close
              </button>
            </div>

            <div className="mt-4">
              {logsLoading ? (
                <p className="text-sm text-gray-500">Loading logs…</p>
              ) : logsError ? (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{logsError}</div>
              ) : logs.length === 0 ? (
                <p className="text-sm text-gray-500">No logs found.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {logs.map((l) => (
                    <li key={l.id} className="rounded-md border p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-gray-600">{new Date(l.applied_at).toLocaleString()}</div>
                        <div className={`text-xs ${l.success ? "text-green-600" : "text-red-600"}`}>
                          {l.success ? "OK" : "FAIL"}
                        </div>
                      </div>
                      <div className="mt-1 font-medium">{l.migration}</div>
                      {l.error && <pre className="mt-2 text-xs text-red-700 whitespace-pre-wrap">{l.error}</pre>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
