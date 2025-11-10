"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Trash2,
  Edit2,
  Plus,
  Save,
  X,
  Search,
  ToggleLeft,
  ToggleRight,
  Settings,
  AlertTriangle,
} from "lucide-react";

type JsonMap = Record<string, any>;

interface RestRequest {
  id: string;
  name: string;
  description?: string;
  url: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
  params: JsonMap;
  headers: Record<string, string>;
  body: JsonMap;
  auth_type: "none" | "bearer" | "basic" | "apikey" | "custom";
  auth_config: JsonMap;
  field_types: Record<string, "text" | "number" | "boolean" | "json" | "textarea">;
  enabled: boolean;
}

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;
const AUTH_TYPES = [
  { value: "none", label: "None" },
  { value: "bearer", label: "Bearer Token" },
  { value: "basic", label: "Basic Auth" },
  { value: "apikey", label: "API Key" },
  { value: "custom", label: "Custom Headers" },
] as const;
const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Boolean" },
  { value: "json", label: "JSON" },
  { value: "textarea", label: "Text Area" },
] as const;

function inferFieldType(name: string): "text" | "number" | "boolean" | "json" | "textarea" {
  const n = name.toLowerCase();
  if (/(count|limit|offset|page|size|id|year|age|amount|total)$/.test(n)) return "number";
  if (/^(is_|has_|enabled|active|disabled|deleted)/.test(n)) return "boolean";
  if (/(payload|data|json|body|meta)$/.test(n)) return "json";
  if (/(desc|description|notes|comment|message|content)$/.test(n)) return "textarea";
  return "text";
}

type ModalProps = {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  initialSize?: { width: number; height: number };
};

/**
 * Draggable + resizable modal.
 * - Drag from the entire header (except elements with data-no-drag).
 * - Movement clamped to viewport.
 */
function DraggableResizableModal({
  title,
  onClose,
  children,
  initialSize = { width: 560, height: 380 },
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 140, y: 140 });
  const [size, setSize] = useState(initialSize);

  // Dragging
  useEffect(() => {
    const header = headerRef.current!;
    let dragging = false;
    let startX = 0,
      startY = 0,
      startLeft = 0,
      startTop = 0;

    function onMouseDown(e: MouseEvent) {
      // Allow drag from entire header except explicit no-drag controls
      if ((e.target as HTMLElement)?.closest?.("[data-no-drag]")) return;
      dragging = true;
      const rect = modalRef.current!.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      startLeft = rect.left;
      startTop = rect.top;
      e.preventDefault();
    }

    function onMouseMove(e: MouseEvent) {
      if (!dragging) return;
      const nx = startLeft + (e.clientX - startX);
      const ny = startTop + (e.clientY - startY);
      // Clamp to viewport
      const maxX = window.innerWidth - size.width - 8;
      const maxY = window.innerHeight - size.height - 8;
      const clampedX = Math.max(8, Math.min(nx, Math.max(8, maxX)));
      const clampedY = Math.max(8, Math.min(ny, Math.max(8, maxY)));
      setPos({ x: clampedX, y: clampedY });
    }

    function onMouseUp() {
      dragging = false;
    }

    header.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      header.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [size.width, size.height]);

  // Resizing
  useEffect(() => {
    const el = modalRef.current!;
    const handle = el.querySelector(".rt-resize") as HTMLElement;
    let resizing = false,
      sx = 0,
      sy = 0,
      sw = 0,
      sh = 0;

    function onDown(e: MouseEvent) {
      resizing = true;
      sx = e.clientX;
      sy = e.clientY;
      sw = size.width;
      sh = size.height;
      e.preventDefault();
      e.stopPropagation();
    }
    function onMove(e: MouseEvent) {
      if (!resizing) return;
      const nw = Math.max(360, sw + (e.clientX - sx));
      const nh = Math.max(280, sh + (e.clientY - sy));
      setSize({ width: nw, height: nh });
    }
    function onUp() {
      resizing = false;
    }

    handle.addEventListener("mousedown", onDown);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      handle.removeEventListener("mousedown", onDown);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [size.width, size.height]);

  // Clamp on window resize
  useEffect(() => {
    function clamp() {
      setPos((p) => {
        const maxX = Math.max(8, window.innerWidth - size.width - 8);
        const maxY = Math.max(8, window.innerHeight - size.height - 8);
        return { x: Math.min(Math.max(8, p.x), maxX), y: Math.min(Math.max(8, p.y), maxY) };
      });
    }
    window.addEventListener("resize", clamp);
    return () => window.removeEventListener("resize", clamp);
  }, [size.width, size.height]);

  return (
    <div className="fixed inset-0 z-[9999]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        ref={modalRef}
        className="absolute bg-white dark:bg-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-2xl overflow-hidden"
        style={{ left: pos.x, top: pos.y, width: size.width, height: size.height }}
      >
        <div
          ref={headerRef}
          className="cursor-move select-none px-4 py-3 bg-zinc-100 dark:bg-zinc-800 font-semibold flex items-center justify-between"
          title="Drag window"
        >
          <span className="truncate pr-4">{title}</span>
          <button
            data-no-drag
            onClick={onClose}
            className="px-2 py-1 text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white"
            aria-label="Close"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-4 h-[calc(100%-48px)] overflow-auto">{children}</div>
        <div className="rt-resize absolute right-0 bottom-0 w-4 h-4 cursor-nwse-resize bg-gradient-to-tr from-transparent to-zinc-300/80 dark:to-zinc-600/80" />
      </div>
    </div>
  );
}

export default function RestTesterAdmin() {
  const [requests, setRequests] = useState<RestRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Modals
  const [showParamModal, setShowParamModal] = useState(false);
  const [paramDraft, setParamDraft] = useState<{ name: string; type: RestRequest["field_types"][string]; value: string }>({ name: "", type: "text", value: "" });

  const [showHeaderModal, setShowHeaderModal] = useState(false);
  const [headerDraft, setHeaderDraft] = useState<{ name: string; value: string }>({ name: "", value: "" });

  const [showAuthModal, setShowAuthModal] = useState(false);

  // Delete confirm modal
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const emptyForm: RestRequest = {
    id: "",
    name: "",
    description: "",
    url: "",
    method: "GET",
    params: {},
    headers: {},
    body: {},
    auth_type: "none",
    auth_config: {},
    field_types: {},
    enabled: true,
  };
  const [formData, setFormData] = useState<RestRequest>(emptyForm);

  useEffect(() => {
    loadRequests();
  }, []);

  async function loadRequests() {
    try {
      const res = await fetch("/api/modules/rest-tester/requests?includeDisabled=1");
      const data = await res.json();
      setRequests(data.requests || []);
    } catch (err) {
      console.error("Failed to load requests:", err);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return (requests || [])
      .filter((r) => r.name.toLowerCase().includes(s) || (r.description || "").toLowerCase().includes(s) || r.url.toLowerCase().includes(s))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [requests, search]);

  function startNew() {
    setSelectedId(null);
    setFormData({ ...emptyForm });
  }

  function startEdit(req: RestRequest) {
    setSelectedId(req.id);
    setFormData({ ...req });
  }

  async function saveForm() {
    try {
      const isUpdate = Boolean(selectedId);
      const url = isUpdate ? `/api/modules/rest-tester/requests/${selectedId}` : "/api/modules/rest-tester/requests";
      const method = isUpdate ? "PUT" : "POST";
      const payload = { ...formData };
      if (!isUpdate) delete (payload as any).id;
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Save failed");
      await loadRequests();
      if (!isUpdate) {
        const created = (await res.json()).request as RestRequest;
        startEdit(created);
      }
    } catch (e) {
      console.error(e);
    }
  }

  function askDelete(req: RestRequest) {
    setDeleteTarget({ id: req.id, name: req.name || "(untitled)" });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/modules/rest-tester/requests/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      await loadRequests();
      if (selectedId === deleteTarget.id) startNew();
      setDeleteTarget(null);
    } catch (e) {
      console.error(e);
    }
  }

  async function toggleEnabled(req: RestRequest) {
    try {
      const res = await fetch(`/api/modules/rest-tester/requests/${req.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !req.enabled }),
      });
      if (!res.ok) throw new Error("Toggle failed");
      setRequests((prev) => prev.map((r) => (r.id === req.id ? { ...r, enabled: !r.enabled } : r)));
      if (selectedId === req.id) setFormData((fd) => ({ ...fd, enabled: !fd.enabled }));
    } catch (e) {
      console.error(e);
    }
  }

  function openAddParam() {
    setParamDraft({ name: "", type: "text", value: "" });
    setShowParamModal(true);
  }

  function addParamConfirm() {
    const { name, type, value } = paramDraft;
    if (!name) return;
    setFormData((prev) => ({
      ...prev,
      params: { ...prev.params, [name]: value },
      field_types: { ...prev.field_types, [name]: type },
    }));
    setShowParamModal(false);
  }

  function openAddHeader() {
    setHeaderDraft({ name: "", value: "" });
    setShowHeaderModal(true);
  }

  function addHeaderConfirm() {
    const { name, value } = headerDraft;
    if (!name) return;
    setFormData((prev) => ({
      ...prev,
      headers: { ...prev.headers, [name]: value },
    }));
    setShowHeaderModal(false);
  }

  function openAuthModal() {
    setShowAuthModal(true);
  }

  function AuthModalContent() {
    const type = formData.auth_type;
    if (type === "none") return <div className="text-sm text-zinc-500">No authentication selected.</div>;

    if (type === "bearer") {
      return (
        <div className="space-y-2">
          <label className="block text-sm font-medium">Token</label>
          <input
            className="border rounded-md px-3 py-2 w-full"
            value={formData.auth_config?.token || ""}
            onChange={(e) => setFormData((p) => ({ ...p, auth_config: { ...(p.auth_config || {}), token: e.target.value } }))
            }
            placeholder="Bearer token"
          />
        </div>
      );
    }
    if (type === "basic") {
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium">Username</label>
            <input
              className="border rounded-md px-3 py-2 w-full"
              value={formData.auth_config?.username || ""}
              onChange={(e) => setFormData((p) => ({ ...p, auth_config: { ...(p.auth_config || {}), username: e.target.value } }))
              }
              placeholder="username"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Password</label>
            <input
              type="password"
              className="border rounded-md px-3 py-2 w-full"
              value={formData.auth_config?.password || ""}
              onChange={(e) => setFormData((p) => ({ ...p, auth_config: { ...(p.auth_config || {}), password: e.target.value } }))
              }
              placeholder="password"
            />
          </div>
        </div>
      );
    }
    if (type === "apikey") {
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium">Header Name</label>
            <input
              className="border rounded-md px-3 py-2 w-full"
              value={formData.auth_config?.keyName || "X-API-Key"}
              onChange={(e) => setFormData((p) => ({ ...p, auth_config: { ...(p.auth_config || {}), keyName: e.target.value } }))
              }
            />
          </div>
          <div>
            <label className="block text-sm font-medium">API Key Value</label>
            <input
              className="border rounded-md px-3 py-2 w-full"
              value={formData.auth_config?.keyValue || ""}
              onChange={(e) => setFormData((p) => ({ ...p, auth_config: { ...(p.auth_config || {}), keyValue: e.target.value } }))
              }
            />
          </div>
        </div>
      );
    }
    // custom headers
    return (
      <div className="space-y-3">
        <p className="text-sm text-zinc-500">Custom auth headers</p>
        {Object.entries(formData.auth_config || {}).map(([k, v]) => (
          <div key={k} className="flex gap-2">
            <input className="border rounded-md px-3 py-2 flex-1" value={k} disabled />
            <input
              className="border rounded-md px-3 py-2 flex-1"
              value={String(v)}
              onChange={(e) => setFormData((p) => ({ ...p, auth_config: { ...(p.auth_config || {}), [k]: e.target.value } }))
              }
            />
            <button
              className="px-3 py-2 text-red-600 hover:bg-red-50 rounded"
              onClick={() =>
                setFormData((p) => {
                  const ac = { ...(p.auth_config || {}) };
                  delete ac[k];
                  return { ...p, auth_config: ac };
                })
              }
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <div className="flex gap-2">
          <input
            className="border rounded-md px-3 py-2 flex-1"
            placeholder="Header name"
            value={headerDraft.name}
            onChange={(e) => setHeaderDraft((h) => ({ ...h, name: e.target.value }))}
          />
          <input
            className="border rounded-md px-3 py-2 flex-1"
            placeholder="Header value"
            value={headerDraft.value}
            onChange={(e) => setHeaderDraft((h) => ({ ...h, value: e.target.value }))}
          />
          <button
            className="px-3 py-2 border rounded-md hover:bg-zinc-50"
            onClick={() => {
              if (!headerDraft.name) return;
              setFormData((p) => ({ ...p, auth_config: { ...(p.auth_config || {}), [headerDraft.name]: headerDraft.value } }));
              setHeaderDraft({ name: "", value: "" });
            }}
          >
            Add
          </button>
        </div>
      </div>
    );
  }

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="flex h-[calc(100vh-140px)]">
      {/* Sidebar */}
      <div className="w-80 border-r bg-white dark:bg-zinc-900 dark:text-zinc-100">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            <Search size={16} className="text-zinc-400" />
            <input
              className="w-full border rounded-md px-3 py-2"
              placeholder="Search requests..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            onClick={startNew}
            className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-black text-white dark:bg-white dark:text-black rounded-md"
          >
            <Plus size={16} /> New Request
          </button>
        </div>
        <div className="overflow-auto" style={{ maxHeight: "calc(100% - 110px)" }}>
          {filtered.map((req) => (
            <div
              key={req.id}
              className={`px-3 py-3 border-b hover:bg-zinc-50 dark:hover:bg-zinc-800 ${
                selectedId === req.id ? "bg-zinc-50 dark:bg-zinc-800" : ""
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-700 rounded">
                      {req.method}
                    </span>
                    <button className="text-left font-medium truncate" onClick={() => startEdit(req)} title={req.name}>
                      {req.name || "(untitled)"}
                    </button>
                  </div>
                  <div className="text-xs text-zinc-500 truncate">{req.url}</div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700"
                    onClick={() => startEdit(req)}
                    title="Edit"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 text-red-600"
                    onClick={() => askDelete(req)}
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                  <button
                    className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700"
                    onClick={() => toggleEnabled(req)}
                    title={req.enabled ? "Disable" : "Enable"}
                  >
                    {req.enabled ? <ToggleRight size={16} className="text-green-600" /> : <ToggleLeft size={16} className="text-zinc-400" />}
                  </button>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <div className="p-4 text-sm text-zinc-500">No requests found.</div>}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 p-6 space-y-6 bg-white dark:bg-zinc-950 dark:text-zinc-100">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">{selectedId ? "Edit Request" : "New Request"}</h2>
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-2 border rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800"
              onClick={() => setFormData((f) => ({ ...f, enabled: !f.enabled }))}
              title="Toggle enabled"
            >
              {formData.enabled ? "Enabled" : "Disabled"}
            </button>
            <button
              onClick={saveForm}
              className="flex items-center gap-2 px-4 py-2 bg-black text-white dark:bg-white dark:text-black rounded-md"
            >
              <Save size={16} /> Save
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full border rounded-md px-3 py-2"
              placeholder="My API Request"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Method *</label>
            <select
              value={formData.method}
              onChange={(e) => setFormData({ ...formData, method: e.target.value as RestRequest["method"] })}
              className="w-full border rounded-md px-3 py-2"
            >
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Description</label>
            <input
              type="text"
              value={formData.description || ""}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full border rounded-md px-3 py-2"
              placeholder="Optional description"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">URL *</label>
            <input
              type="text"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              className="w-full border rounded-md px-3 py-2"
              placeholder="https://api.example.com/endpoint"
            />
          </div>
        </div>

        {/* Auth */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Authentication</label>
              <select
                value={formData.auth_type}
                onChange={(e) => {
                  const at = e.target.value as RestRequest["auth_type"];
                  setFormData({ ...formData, auth_type: at, auth_config: {} });
                }}
                className="w-full border rounded-md px-3 py-2"
              >
                {AUTH_TYPES.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="pt-6 pl-2">
              <button
                onClick={openAuthModal}
                className="flex items-center gap-2 px-3 py-2 border rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                <Settings size={16} /> Configure Auth
              </button>
            </div>
          </div>
          {formData.auth_type !== "none" && (
            <div className="text-xs text-zinc-500">Configured: {Object.keys(formData.auth_config || {}).length} field(s)</div>
          )}
        </div>

        {/* Headers */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Headers</h3>
            <button
              onClick={openAddHeader}
              className="flex items-center gap-2 px-3 py-2 border rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              <Plus size={16} /> Add Header
            </button>
          </div>
          {Object.entries(formData.headers || {}).length === 0 ? (
            <div className="text-sm text-zinc-500">No headers</div>
          ) : (
            <div className="space-y-2">
              {Object.entries(formData.headers || {}).map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <input className="border rounded-md px-3 py-2 flex-1" value={k} disabled />
                  <input
                    className="border rounded-md px-3 py-2 flex-1"
                    value={v}
                    onChange={(e) => setFormData((p) => ({ ...p, headers: { ...(p.headers || {}), [k]: e.target.value } }))}
                  />
                  <button
                    className="px-3 py-2 text-red-600 hover:bg-red-50 rounded"
                    onClick={() => setFormData((p) => {
                      const h = { ...(p.headers || {}) };
                      delete h[k];
                      return { ...p, headers: h };
                    })}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Params */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Parameters (Query/Body)</h3>
            <button
              onClick={openAddParam}
              className="flex items-center gap-2 px-3 py-2 border rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              <Plus size={16} /> Add Parameter
            </button>
          </div>
          {Object.entries(formData.params || {}).length === 0 ? (
            <div className="text-sm text-zinc-500">No parameters</div>
          ) : (
            <div className="space-y-2">
              {Object.entries(formData.params || {}).map(([k, v]) => (
                <div key={k} className="grid grid-cols-12 gap-2">
                  <input className="col-span-4 border rounded-md px-3 py-2" value={k} disabled />
                  <select
                    className="col-span-3 border rounded-md px-3 py-2"
                    value={formData.field_types?.[k] || "text"}
                    onChange={(e) => setFormData(p => ({ ...p, field_types: { ...(p.field_types || {}), [k]: e.target.value as any } }))}
                  >
                    {FIELD_TYPES.map((ft) => (
                      <option key={ft.value} value={ft.value}>
                        {ft.label}
                      </option>
                    ))}
                  </select>
                  <input
                    className="col-span-4 border rounded-md px-3 py-2"
                    value={String(v)}
                    onChange={(e) => setFormData(p => ({ ...p, params: { ...(p.params || {}), [k]: e.target.value } }))}
                  />
                  <button
                    className="col-span-1 px-3 py-2 text-red-600 hover:bg-red-50 rounded"
                    onClick={() => setFormData(p => {
                      const params = { ...(p.params || {}) };
                      const types = { ...(p.field_types || {}) };
                      delete params[k];
                      delete types[k];
                      return { ...p, params, field_types: types };
                    })}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Param Modal */}
        {showParamModal && (
          <DraggableResizableModal title="Add Parameter" onClose={() => setShowParamModal(false)} initialSize={{ width: 560, height: 300 }}>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  className="border rounded-md px-3 py-2 w-full"
                  value={paramDraft.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setParamDraft((p) => ({ ...p, name, type: inferFieldType(name) }));
                  }}
                  placeholder="e.g. userId, limit, is_active, payload"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Type</label>
                  <select
                    className="border rounded-md px-3 py-2 w-full"
                    value={paramDraft.type}
                    onChange={(e) => setParamDraft((p) => ({ ...p, type: e.target.value as any }))}
                  >
                    {FIELD_TYPES.map((ft) => (
                      <option key={ft.value} value={ft.value}>
                        {ft.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Default Value</label>
                  <input
                    className="border rounded-md px-3 py-2 w-full"
                    value={paramDraft.value}
                    onChange={(e) => setParamDraft((p) => ({ ...p, value: e.target.value }))}
                    placeholder="Optional"
                  />
                </div>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button className="px-3 py-2 border rounded-md" onClick={() => setShowParamModal(false)}>
                  Cancel
                </button>
                <button className="px-3 py-2 bg-black text-white rounded-md" onClick={addParamConfirm}>
                  Add
                </button>
              </div>
            </div>
          </DraggableResizableModal>
        )}

        {/* Add Header Modal */}
        {showHeaderModal && (
          <DraggableResizableModal title="Add Header" onClose={() => setShowHeaderModal(false)} initialSize={{ width: 560, height: 240 }}>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Header Name</label>
                  <input
                    className="border rounded-md px-3 py-2 w-full"
                    value={headerDraft.name}
                    onChange={(e) => setHeaderDraft((h) => ({ ...h, name: e.target.value }))}
                    placeholder="e.g. Content-Type"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Value</label>
                  <input
                    className="border rounded-md px-3 py-2 w-full"
                    value={headerDraft.value}
                    onChange={(e) => setHeaderDraft((h) => ({ ...h, value: e.target.value }))}
                    placeholder="e.g. application/json"
                  />
                </div>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button className="px-3 py-2 border rounded-md" onClick={() => setShowHeaderModal(false)}>
                  Cancel
                </button>
                <button className="px-3 py-2 bg-black text-white rounded-md" onClick={addHeaderConfirm}>
                  Add
                </button>
              </div>
            </div>
          </DraggableResizableModal>
        )}

        {/* Auth Modal */}
        {showAuthModal && (
          <DraggableResizableModal title="Configure Authentication" onClose={() => setShowAuthModal(false)} initialSize={{ width: 580, height: 380 }}>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Auth Type</label>
                <select
                  className="border rounded-md px-3 py-2 w-full"
                  value={formData.auth_type}
                  onChange={(e) => setFormData((p) => ({ ...p, auth_type: e.target.value as any, auth_config: {} }))}
                >
                  {AUTH_TYPES.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>
              <AuthModalContent />
              <div className="pt-2 flex justify-end gap-2">
                <button className="px-3 py-2 border rounded-md" onClick={() => setShowAuthModal(false)}>
                  Close
                </button>
                <button className="px-3 py-2 bg-black text-white rounded-md" onClick={() => setShowAuthModal(false)}>
                  Done
                </button>
              </div>
            </div>
          </DraggableResizableModal>
        )}
      </div>

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <DraggableResizableModal title="Confirm Delete" onClose={() => setDeleteTarget(null)} initialSize={{ width: 460, height: 220 }}>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-amber-500 mt-1" size={20} />
              <div>
                <div className="font-medium">Delete request?</div>
                <div className="text-sm text-zinc-500">This action cannot be undone.</div>
                <div className="text-sm mt-1">
                  <span className="font-mono px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded">{deleteTarget.name}</span>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button className="px-3 py-2 border rounded-md" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button className="px-3 py-2 bg-red-600 text-white rounded-md" onClick={confirmDelete}>
                Delete
              </button>
            </div>
          </div>
        </DraggableResizableModal>
      )}
    </div>
  );
}