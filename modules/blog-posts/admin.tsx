"use client";
import React, { useEffect, useState, useCallback, useMemo } from "react";
import MarkdownEditor from "./Editor.client";
const SIDEBAR_W = 360;
const SIDEBAR_MIN = 220;
const SIDEBAR_MAX = 600;

const EDITOR_MIN = 900;
const EDITOR_MAX = 1600;
const HANDLE_W = 6;

type Post = {
  id?: number;
  title?: string | null;
  slug?: string;
  summary?: string | null;
  content?: string | null; // store Markdown here
  published?: boolean;
  archived?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
  share_settings?: Record<string, boolean>;
};

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      style={{ width: 44, height: 26, borderRadius: 16, padding: 2, background: checked ? "#0b66ff" : "#e6e6e6", border: "none", display: "inline-flex", alignItems: "center", cursor: "pointer" }}
    >
      <span style={{ width: 20, height: 20, borderRadius: 12, background: "#fff", transform: checked ? "translateX(18px)" : "translateX(0)", transition: "transform 120ms ease" }} />
    </button>
  );
}

export default function BlogPostsModuleAdmin(/* props if any */) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Post | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editorSeed, setEditorSeed] = useState(0); // force new editor instance for new post

  // Mount flag to avoid SSR/client mismatch
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Use SSR-safe defaults for initial render
  const [sidebarW, setSidebarW] = useState<number>(SIDEBAR_W);
  const [rightW, setRightW] = useState<number>(EDITOR_MIN);

  // Load saved sidebar width after mount
  useEffect(() => {
    if (!mounted) return;
    try {
      const saved = Number(window.localStorage.getItem("blogAdminSidebarWidth") || 0);
      if (Number.isFinite(saved) && saved > 0) {
        setSidebarW(Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, saved)));
      }
    } catch {}
  }, [mounted]);

  // Load saved editor width (or compute fallback) after mount
  useEffect(() => {
    if (!mounted) return;
    try {
      const saved = Number(window.localStorage.getItem("blogAdminRightWidth") || 0);
      if (Number.isFinite(saved) && saved > 0) {
        setRightW(Math.max(EDITOR_MIN, Math.min(EDITOR_MAX, saved)));
      } else {
        const fallback = Math.max(EDITOR_MIN, window.innerWidth - sidebarW - HANDLE_W - 80);
        setRightW(Math.min(EDITOR_MAX, fallback));
      }
    } catch {}
  }, [mounted, sidebarW]);

  // Persist widths (only after mount)
  useEffect(() => {
    if (!mounted) return;
    try { window.localStorage.setItem("blogAdminSidebarWidth", String(sidebarW)); } catch {}
  }, [mounted, sidebarW]);

  useEffect(() => {
    if (!mounted) return;
    try { window.localStorage.setItem("blogAdminRightWidth", String(rightW)); } catch {}
  }, [mounted, rightW]);

  const startDragSidebar = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = sidebarW;
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const next = Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, startW + dx));
      setSidebarW(next);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [sidebarW]);

  const startDragEditor = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = rightW;
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const next = Math.max(EDITOR_MIN, Math.min(EDITOR_MAX, startW + dx));
      setRightW(next);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [rightW]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setBusy(true);
    try {
      const res = await fetch(`/api/modules/blog-posts/admin`, { cache: "no-store" });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "failed to load");
      setPosts(j.posts || []);
    } catch (e: any) {
      setErrorMessage(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  function startNew() {
    setEditing({
      title: "",
      slug: "",
      summary: "",
      content: "",
      published: false,
      archived: false,
      share_settings: { x: true, twitter: true, linkedin: false },
    });
    setEditorSeed((n) => n + 1);
  }

  function startEdit(p: Post) {
    setEditing({ ...p });
  }

  async function uploadImage(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json?.url) return json.url as string;
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error("read failed"));
      r.readAsDataURL(file);
    });
  }

  const handleEditorChange = useCallback((md: string) => {
    setEditing((prev) => (prev ? { ...prev, content: md } : prev));
  }, []);

  async function save() {
    if (!editing) return;
    setBusy(true);
    setErrorMessage(null);
    try {
      const payload = {
        ...editing,
        content: editing.content || "", // Markdown
        share_settings: editing.share_settings || {},
      };
      const method = editing.id ? "PUT" : "POST";
      const url = editing.id ? `/api/modules/blog-posts/admin/${editing.id}` : `/api/modules/blog-posts/admin`;
      const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "save failed");
      await load();
      if (j?.post) setEditing(j.post);
      else setEditing(null);
    } catch (e: any) {
      setErrorMessage(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id?: number) {
    if (!id || !confirm("Delete this post?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/modules/blog-posts/admin/${id}`, { method: "DELETE" });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "delete failed");
      await load();
      if (editing?.id === id) setEditing(null);
    } catch (e: any) {
      setErrorMessage(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function togglePublishPost(p: Post) {
    if (!p.id) return;
    setBusy(true);
    try {
      const copy = { ...p, published: !p.published };
      const res = await fetch(`/api/modules/blog-posts/admin/${p.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(copy),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "toggle failed");
      await load();
    } catch (e: any) {
      setErrorMessage(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  const canSave = !!editing && !!(editing.title && editing.slug) && !busy;
  const editorKey = useMemo(() => (editing?.id ? `post:${editing.id}` : `new:${editorSeed}`), [editing?.id, editorSeed]);

  return (
    <div style={{ minHeight: "100vh", padding: 18, background: "#f7f7fb" }}>
      <main
        style={{
          maxWidth: "100%",
          margin: "0 auto",
          display: "grid",
          // Columns: [sidebar] [left handle] [editor] [right handle]
          gridTemplateColumns: `${sidebarW}px ${HANDLE_W}px ${rightW}px ${HANDLE_W}px`,
          gap: 22,
          alignItems: "start",
          padding: "10px 24px",
        }}
      >
        <aside style={{ overflow: "auto" }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 14, boxShadow: "0 6px 18px rgba(15,23,42,0.03)", maxHeight: "82vh", overflow: "auto", position: "sticky", top: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>Posts</div>
                <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>{busy ? "Loading…" : `${posts.length} posts`}</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <button type="button" onClick={load} style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid #e6e6e6", background: "#fff", fontSize: 13 }}>Refresh</button>
              <button type="button" onClick={startNew} style={{ flex: 1, padding: "8px 10px", borderRadius: 8, background: "#111", color: "#fff", fontSize: 13 }}>New</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {posts.map((p) => (
                <div key={p.id} onClick={() => startEdit(p)} style={{ padding: 12, borderRadius: 10, cursor: "pointer", background: editing?.id === p.id ? "#f0f7ff" : "#fff", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{p.title || "Untitled"}</div>
                    <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>{p.slug}</div>
                    <div style={{ fontSize: 11, color: "#999", marginTop: 8 }}>{p.created_at ? new Date(p.created_at).toLocaleDateString() : ""}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button type="button" title="Publish/unpublish" onClick={(e) => { e.stopPropagation(); togglePublishPost(p); }} style={{ padding: "6px 8px", fontSize: 13 }}>📤</button>
                      <button type="button" title="Delete" onClick={(e) => { e.stopPropagation(); remove(p.id); }} style={{ padding: "6px 8px", fontSize: 13 }}>🗑️</button>
                    </div>
                    <div style={{ fontSize: 11 }}>
                      {p.published ? <span style={{ color: "green" }}>Published</span> : <span style={{ color: "#888" }}>Draft</span>}
                    </div>
                  </div>
                </div>
              ))}
              {posts.length === 0 && <div style={{ color: "#666", padding: 6 }}>No posts yet.</div>}
            </div>
          </div>
        </aside>

        {/* Left handle: resizes sidebar */}
        <div
          onMouseDown={startDragSidebar}
          title="Drag to resize sidebar"
          style={{
            cursor: "col-resize",
            width: HANDLE_W,
            background: "#e5e7eb",
            borderRadius: 3,
            alignSelf: "stretch",
            justifySelf: "center",
          }}
        />

        <section
          style={{
            background: "#fff",
            borderRadius: 12,
            padding: 18,
            boxShadow: "0 6px 18px rgba(15,23,42,0.03)",
            minWidth: EDITOR_MIN,
            maxWidth: EDITOR_MAX,
            overflow: "auto",
            position: "relative",
          }}
        >
          {!editing ? (
            <div style={{ textAlign: "center", color: "#666", padding: 64, fontSize: 16 }}>Select a post from the left or click New</div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 14 }}>
                <div style={{ flex: 1 }}>
                  <input
                    value={editing.title || ""}
                    onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                    placeholder="Title"
                    style={{ width: "100%", fontSize: 26, padding: "8px 10px", border: "none", borderBottom: "1px solid #eee", fontWeight: 700 }}
                  />
                  <input
                    value={editing.slug || ""}
                    onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
                    placeholder="slug-for-url"
                    style={{ width: "100%", marginTop: 8, padding: "7px 10px", fontSize: 13, color: "#666", border: "1px solid #f0f0f0", borderRadius: 6 }}
                  />
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <button
                    type="button"
                    onClick={save}
                    disabled={!canSave}
                    style={{ padding: "8px 14px", background: canSave ? "#0b66ff" : "#cbdcff", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, cursor: canSave ? "pointer" : "default" }}
                  >
                    {busy ? "Saving…" : "Save"}
                  </button>

                  <div style={{ display: "flex", gap: 14, alignItems: "center", fontSize: 13, color: "#333" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ color: "#666" }}>Published</span>
                      <Switch checked={!!editing.published} onChange={(v) => setEditing({ ...editing, published: v })} />
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ color: "#666" }}>Archived</span>
                      <Switch checked={!!editing.archived} onChange={(v) => setEditing({ ...editing, archived: v })} />
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <MarkdownEditor
                  key={editorKey}
                  valueMd={editing.content || ""}
                  onChangeMd={handleEditorChange}
                  onUploadImage={uploadImage}
                />
              </div>

              <input
                value={editing.summary || ""}
                onChange={(e) => setEditing({ ...editing, summary: e.target.value })}
                placeholder="Summary (optional)"
                style={{ width: "100%", padding: "10px", marginTop: 14, borderRadius: 8, border: "1px solid #f0f0f0", fontSize: 14 }}
              />

              <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ fontSize: 14, color: "#333", marginRight: 6 }}>Enable share on:</div>
                  <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 14 }}>X (twitter)</span>
                      <Switch checked={!!(editing.share_settings?.x || editing.share_settings?.twitter)} onChange={(v) => setEditing({ ...editing, share_settings: { ...(editing.share_settings || {}), x: v, twitter: v } })} />
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 14 }}>LinkedIn</span>
                      <Switch checked={!!editing.share_settings?.linkedin} onChange={(v) => setEditing({ ...editing, share_settings: { ...(editing.share_settings || {}), linkedin: v } })} />
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 14 }}>Copy link</span>
                      <Switch checked={!!editing.share_settings?.copy_link} onChange={(v) => setEditing({ ...editing, share_settings: { ...(editing.share_settings || {}), copy_link: v } })} />
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 14 }}>Embed</span>
                      <Switch checked={!!editing.share_settings?.embed} onChange={(v) => setEditing({ ...editing, share_settings: { ...(editing.share_settings || {}), embed: v } })} />
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: 13, color: "#777" }}>{editing.id ? `Edited: ${editing.updated_at || ""}` : "New post"}</div>
              </div>
            </>
          )}

          {errorMessage && (
            <div style={{ marginTop: 12, color: "crimson" }}>
              {errorMessage} <button type="button" onClick={() => setErrorMessage(null)} style={{ marginLeft: 8 }}>Dismiss</button>
            </div>
          )}
        </section>

        {/* Right handle: resizes editor pane (on the right side of the box) */}
        <div
          onMouseDown={startDragEditor}
          title="Drag to resize editor"
          style={{
            cursor: "col-resize",
            width: HANDLE_W,
            background: "#e5e7eb",
            borderRadius: 3,
            alignSelf: "stretch",
            justifySelf: "center",
          }}
        />
      </main>
    </div>
  );
}