// app/admin/modules/page.tsx
"use client";

import { useEffect, useRef, useState, useMemo, JSX } from "react";
import dynamic from "next/dynamic";
import { loadManifestsWithRegistry } from "@/lib/modules";
import ReactMarkdown from "react-markdown";

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
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".sql")) return "sql";
  if (lower.endsWith(".ts") || lower.endsWith(".tsx")) return "typescript";
  if (lower.endsWith(".css") || lower.endsWith(".scss")) return "css";
  if (lower.endsWith(".md")) return "markdown";
  return "typescript";
}

// Tree file structure component - updated to handle nested tree structure
function FileTree({ tree, onSelect, activeFile }: { tree: any; onSelect: (f: string) => void; activeFile: string }) {
  function renderNode(node: any, depth = 0): JSX.Element[] {
    if (!node) return [];
    
    const els: JSX.Element[] = [];
    const children = node.children || [];

    children.forEach((child: any) => {
      if (child.type === "dir") {
        els.push(
          <div key={child.path} style={{ paddingLeft: depth * 12 }} className="text-xs py-0.5 font-medium text-gray-700">
            📁 {child.name}
          </div>
        );
        els.push(...renderNode(child, depth + 1));
      } else if (child.type === "file") {
        const isActive = child.path === activeFile;
        els.push(
          <button
            key={child.path}
            onClick={() => onSelect(child.path)}
            style={{ paddingLeft: depth * 12 }}
            className={`block w-full text-left text-xs py-1 hover:bg-gray-100 ${isActive ? "bg-blue-50 font-medium" : ""}`}
          >
            📄 {child.name}
          </button>
        );
      }
    });

    return els;
  }

  return <div className="text-sm">{renderNode(tree)}</div>;
}

export default function AdminModulesPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ModuleRow[]>([]);
  const [error, setError] = useState("");

  // module editor state
  const [selected, setSelected] = useState<string>("");

  // Module files editor
  const [filesOpen, setFilesOpen] = useState(false);
  const [moduleFileTree, setModuleFileTree] = useState<any>(null);
  const [activeModuleFile, setActiveModuleFile] = useState<string>("");
  const [activeModuleCode, setActiveModuleCode] = useState<string>("");
  const [fileMsg, setFileMsg] = useState("");
  const [fileTreeWidth, setFileTreeWidth] = useState(300);
  const [drawerWidth, setDrawerWidth] = useState(75); // percentage of viewport width
  const [isResizingTree, setIsResizingTree] = useState(false);
  const [isResizingDrawer, setIsResizingDrawer] = useState(false);

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
  const [uninstallResult, setUninstallResult] = useState<any | null>(null);
  const [uninstallLoading, setUninstallLoading] = useState<string | null>(null);

  // Guides
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideContent, setGuideContent] = useState("");
  const [guideLoading, setGuideLoading] = useState(false);
  const [llmPromptOpen, setLlmPromptOpen] = useState(false);
  const [llmPromptContent, setLlmPromptContent] = useState("");
  const [llmPromptLoading, setLlmPromptLoading] = useState(false);

  // Handle file tree resizing
  const handleTreeMouseDown = (e: React.MouseEvent) => {
    setIsResizingTree(true);
    e.preventDefault();
  };

  // Handle drawer resizing
  const handleDrawerMouseDown = (e: React.MouseEvent) => {
    setIsResizingDrawer(true);
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingTree) {
        const drawer = document.querySelector('.module-files-drawer') as HTMLElement;
        if (!drawer) return;
        
        const drawerRect = drawer.getBoundingClientRect();
        const newWidth = e.clientX - drawerRect.left - 24; // 24px for padding
        
        if (newWidth >= 200 && newWidth <= 600) {
          setFileTreeWidth(newWidth);
        }
      }

      if (isResizingDrawer) {
        const newWidthPx = window.innerWidth - e.clientX;
        const newWidthPercent = (newWidthPx / window.innerWidth) * 100;
        
        if (newWidthPercent >= 30 && newWidthPercent <= 95) {
          setDrawerWidth(newWidthPercent);
        }
      }
    };

    const handleMouseUp = () => {
      setIsResizingTree(false);
      setIsResizingDrawer(false);
    };

    if (isResizingTree || isResizingDrawer) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizingTree, isResizingDrawer]);

  async function load() {
    setLoading(true);
    setError("");
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

  function onEditSelect(id: string) {
    setSelected(id);
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

  // Module files editor - updated to use file-tree endpoint
  async function openModuleFiles(moduleId: string) {
    setFilesOpen(true);
    setFileMsg("");
    setActiveModuleFile("");
    setActiveModuleCode("");
    setModuleFileTree(null);
    try {
      const r = await fetch(`/api/admin/modules/file-tree?moduleId=${encodeURIComponent(moduleId)}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok || j?.error) throw new Error(j?.error || `List failed (${r.status})`);
      setModuleFileTree(j.tree || null);
    } catch (e) {
      setFileMsg(prettyErr(e));
    }
  }

  async function loadModuleFile(filePath: string) {
    setActiveModuleFile(filePath);
    setActiveModuleCode("// loading…");
    setFileMsg("");
    try {
      const r = await fetch("/api/admin/code/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: filePath }),
      });
      const j = await r.json();
      if (!r.ok || j?.ok === false) throw new Error(j?.error || `Read failed (${r.status})`);
      setActiveModuleCode(String(j.code || ""));
    } catch (e) {
      setFileMsg(prettyErr(e));
    }
  }

  async function saveModuleFile() {
    if (!activeModuleFile) return;
    setFileMsg("");
    try {
      const r = await fetch("/api/admin/code/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: activeModuleFile, code: activeModuleCode }),
      });
      const j = await r.json();
      if (!r.ok || j?.ok === false) throw new Error(j?.error || `Save failed (${r.status})`);
      setFileMsg("Saved.");
    } catch (e) {
      setFileMsg(prettyErr(e));
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
    setError("");
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

  // Run module uninstall via server route which will execute module's uninstall.js and remove folder
  async function uninstallModule(moduleId: string) {
    if (!confirm(`Uninstall module "${moduleId}"? This will run the module's uninstall script and remove its files.`)) return;
    setUninstallLoading(moduleId);
    setUninstallResult(null);
    try {
      const res = await fetch("/api/admin/modules/uninstall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleId }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.error) {
        throw new Error(j?.error || `uninstall failed (${res.status})`);
      }
      // show uninstall output and refresh list
      setUninstallResult({ moduleId, result: j });
      setNotif({ id: String(Date.now()), kind: "success", text: `Uninstalled ${moduleId}` });
      await load();
    } catch (e) {
      const msg = prettyErr(e);
      setUninstallResult({ moduleId, error: msg });
      setNotif({ id: String(Date.now()), kind: "error", text: `Uninstall failed: ${msg}` });
    } finally {
      setUninstallLoading(null);
    }
  }

  // helper to dismiss install modal
  function closeInstallResult() {
    setInstallResult(null);
  }

  // helper to dismiss uninstall modal
  function closeUninstallResult() {
    setUninstallResult(null);
  }

  // Open module authoring guide
  async function openGuide() {
    setGuideOpen(true);
    setGuideLoading(true);
    try {
      const r = await fetch("/admin/modules/guide/README.md", { cache: "no-store" });
      if (!r.ok) throw new Error(`Failed to load guide (${r.status})`);
      const text = await r.text();
      setGuideContent(text);
    } catch (e) {
      setGuideContent(`# Error\n\nFailed to load guide: ${prettyErr(e)}`);
    } finally {
      setGuideLoading(false);
    }
  }

  // Open LLM prompt guide
  async function openLlmPrompt() {
    setLlmPromptOpen(true);
    setLlmPromptLoading(true);
    try {
      const r = await fetch("/admin/modules/guide/LLM-GUIDE.md", { cache: "no-store" });
      if (!r.ok) throw new Error(`Failed to load LLM guide (${r.status})`);
      const text = await r.text();
      setLlmPromptContent(text);
    } catch (e) {
      setLlmPromptContent(`# Error\n\nFailed to load LLM guide: ${prettyErr(e)}`);
    } finally {
      setLlmPromptLoading(false);
    }
  }

  function copyLlmPrompt() {
    navigator.clipboard.writeText(llmPromptContent);
    setNotif({ id: String(Date.now()), kind: "success", text: "LLM prompt copied to clipboard!" });
  }

  // Handle click outside to close overlays
  const handleOverlayClick = (e: React.MouseEvent, closeFunction: () => void) => {
    if (e.target === e.currentTarget) {
      closeFunction();
    }
  };

  const sorted = useMemo(() => [...rows].sort((a, b) => a.id.localeCompare(b.id)), [rows]);
  const selectedModule = rows.find((r) => r.id === selected);

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
        <div 
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/30"
          onClick={(e) => handleOverlayClick(e, closeInstallResult)}
        >
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
      {/* Uninstall result modal */}
      {uninstallResult && (
        <div 
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/30"
          onClick={(e) => handleOverlayClick(e, closeUninstallResult)}
        >
          <div className="mt-16 w-full max-w-4xl bg-white rounded-lg shadow-lg p-4 overflow-auto" style={{ maxHeight: "75vh" }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-lg font-medium">Uninstall result</div>
                <div className="text-sm text-gray-600">{uninstallResult?.moduleId}</div>
              </div>
              <div>
                <button onClick={closeUninstallResult} className="text-sm px-3 py-1 border rounded">Close</button>
              </div>
            </div>
            <pre style={{ background: "#f7f7fb", padding: 12, borderRadius: 8, overflow: "auto" }}>{JSON.stringify(uninstallResult, null, 2)}</pre>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-semibold">Modules</h1>
        <div className="flex gap-3">
          <SlimBtn onClick={openGuide} variant="outline">
            📖 Guide
          </SlimBtn>
          <SlimBtn onClick={openLlmPrompt} variant="outline">
            🤖 LLM Prompt
          </SlimBtn>
          {selectedModule && (
            <SlimBtn onClick={() => openModuleFiles(selectedModule.id)} variant="primary">
              Edit Files
            </SlimBtn>
          )}
          <SlimBtn onClick={load}>Refresh</SlimBtn>
          <SlimBtn onClick={() => openLogs()} variant="ghost">
            View recent logs
          </SlimBtn>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {/* Single column: just the module list */}
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
                        onClick={() => onEditSelect(m.id)
                        }
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
                        onClick={() => uninstallModule(m.id)}
                        className="text-xs text-red-600 underline underline-offset-4"
                        disabled={uninstallLoading === m.id}
                      >
                        {uninstallLoading === m.id ? "Uninstalling…" : "Delete"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Install area at bottom of module list */}
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

      {/* Install from-folder modal */}
      {installOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/30 flex"
          onClick={(e) => handleOverlayClick(e, () => setInstallOpen(false))}
        >
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

      {/* Drawer: Module Files Editor */}
      {filesOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/30 flex"
          onClick={(e) => handleOverlayClick(e, () => setFilesOpen(false))}
        >
          {/* Drawer resizer - left edge */}
          <div
            onMouseDown={handleDrawerMouseDown}
            className="w-1 bg-transparent hover:bg-blue-400 cursor-col-resize transition-colors relative"
            style={{ 
              cursor: "col-resize",
              marginLeft: `${100 - drawerWidth}%`,
              zIndex: 60
            }}
          />
          
          <div 
            className="module-files-drawer h-full bg-white shadow-xl p-6 overflow-hidden"
            style={{ width: `${drawerWidth}%` }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="font-medium text-lg">Edit Module Files: {selectedModule?.id}</div>
              <button onClick={() => setFilesOpen(false)} className="text-sm opacity-70 hover:opacity-100">
                Close
              </button>
            </div>

            <div className="flex gap-0" style={{ height: "calc(100vh - 140px)" }}>
              {/* file tree */}
              <div 
                className="rounded-l-xl border border-r-0 bg-white p-3 overflow-auto"
                style={{ width: `${fileTreeWidth}px`, minWidth: "200px", maxWidth: "600px" }}
              >
                <div className="text-sm font-medium mb-2">Files</div>
                {!moduleFileTree ? (
                  <p className="text-xs text-gray-500">Loading files...</p>
                ) : !moduleFileTree.children || moduleFileTree.children.length === 0 ? (
                  <p className="text-xs text-gray-500">No files found.</p>
                ) : (
                  <FileTree tree={moduleFileTree} onSelect={loadModuleFile} activeFile={activeModuleFile} />
                )}
              </div>

              {/* File tree resizer */}
              <div
                onMouseDown={handleTreeMouseDown}
                className="w-1 bg-gray-200 hover:bg-blue-400 cursor-col-resize transition-colors"
                style={{ cursor: "col-resize" }}
              />

              {/* Monaco editor */}
              <div className="rounded-r-xl border border-l-0 bg-white p-4 flex flex-col flex-1">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium">{activeModuleFile ? activeModuleFile.split("/").pop() : "Select a file"}</div>
                  {activeModuleFile && (
                    <SlimBtn onClick={saveModuleFile} variant="primary">
                      Save
                    </SlimBtn>
                  )}
                </div>

                <div className="flex-1 ring-1 ring-slate-200 rounded-md overflow-hidden">
                  <Monaco
                    height="100%"
                    defaultLanguage={langFor(activeModuleFile)}
                    path={activeModuleFile || "untitled.tsx"}
                    value={activeModuleCode}
                    onChange={(v) => setActiveModuleCode(v ?? "")}
                    options={{
                      fontSize: 13,
                      minimap: { enabled: false },
                      wordWrap: "on",
                      automaticLayout: true,
                      formatOnPaste: true,
                      formatOnType: true,
                    }}
                  />
                </div>

                {fileMsg && <div className="mt-2 text-xs rounded border bg-neutral-50 p-2">{fileMsg}</div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Drawer: Block Types browser/editor */}
      {blocksOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/30 flex"
          onClick={(e) => handleOverlayClick(e, () => setBlocksOpen(false))}
        >
          <div className="ml-auto h-full w-full max-w-6xl bg-white shadow-xl p-6 overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="font-medium text-lg">Block Types</div>
              <button onClick={() => setBlocksOpen(false)} className="text-sm opacity-70 hover:opacity-100">
                Close
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-[300px_1fr]" style={{ height: "calc(100vh - 140px)" }}>
              {/* file list */}
              <div className="rounded-xl border bg-white p-3 overflow-auto">
                <div className="text-sm font-medium mb-2">Files in /modules</div>
                {blockFiles.length === 0 ? (
                  <p className="text-xs text-gray-500">No files found.</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {blockFiles.map((f) => (
                      <li key={f}>
                        <button
                          className={`underline underline-offset-4 ${activeBlockFile === f ? "font-semibold" : ""}`}
                          onClick={() => loadBlock(f)}
                        >
                          {f.replace("/modules/", "")}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-3 text-xs text-gray-600">
                  Create new block files from your existing "New Block Type" flow if needed.
                </div>
              </div>

              {/* Monaco TS/JS editor */}
              <div className="rounded-xl border bg-white p-4 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium">{activeBlockFile ? activeBlockFile.split("/").pop() : "Select a file"}</div>
                  {activeBlockFile && (
                    <SlimBtn onClick={saveBlock} variant="primary">
                      Save
                    </SlimBtn>
                  )}
                </div>

                <div className="flex-1 ring-1 ring-slate-200 rounded-md overflow-hidden">
                  <Monaco
                    height="100%"
                    defaultLanguage={langFor(activeBlockFile)}
                    path={activeBlockFile || "untitled.tsx"}
                    value={activeBlockCode}
                    onChange={(v) => setActiveBlockCode(v ?? "")}
                    options={{
                      fontSize: 13,
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
        <div 
          className="fixed inset-0 z-50 bg-black/30 flex"
          onClick={(e) => handleOverlayClick(e, () => {
            setLogsOpen(false);
            setLogModule(null);
            setLogs([]);
          })}
        >
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

      {/* Module Authoring Guide Drawer */}
      {guideOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/30 flex"
          onClick={(e) => handleOverlayClick(e, () => setGuideOpen(false))}
        >
          <div className="ml-auto h-full w-full max-w-4xl bg-white shadow-xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b">
              <div className="font-medium text-lg">Module Authoring Guide</div>
              <button onClick={() => setGuideOpen(false)} className="text-sm opacity-70 hover:opacity-100">
                Close
              </button>
            </div>
            
            <div className="flex-1 overflow-auto p-6">
              {guideLoading ? (
                <p className="text-sm text-gray-500">Loading guide...</p>
              ) : (
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown>{guideContent}</ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* LLM Prompt Drawer */}
      {llmPromptOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/30 flex"
          onClick={(e) => handleOverlayClick(e, () => setLlmPromptOpen(false))}
        >
          <div className="ml-auto h-full w-full max-w-4xl bg-white shadow-xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <div className="font-medium text-lg">LLM Module Creation Prompt</div>
                <div className="text-xs text-gray-600 mt-1">Copy this prompt to provide context to AI assistants</div>
              </div>
              <div className="flex gap-2">
                <SlimBtn onClick={copyLlmPrompt} variant="primary" disabled={!llmPromptContent}>
                  📋 Copy
                </SlimBtn>
                <button onClick={() => setLlmPromptOpen(false)} className="text-sm opacity-70 hover:opacity-100">
                  Close
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto p-6">
              {llmPromptLoading ? (
                <p className="text-sm text-gray-500">Loading LLM guide...</p>
              ) : (
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown>{llmPromptContent}</ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
