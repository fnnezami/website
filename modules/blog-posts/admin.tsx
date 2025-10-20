"use client";
import React, { useEffect, useRef, useState } from "react";

type Post = {
  id?: number;
  title?: string | null;
  slug?: string;
  summary?: string | null;
  content?: string | null;
  published?: boolean;
  archived?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
  share_settings?: Record<string, boolean>;
};

const SIDEBAR_W = 360;
const EDITOR_MIN = 900;
const TOOLBAR_BTN = {
  height: 32,
  minWidth: 32,
  borderRadius: 6,
  padding: "0 8px",
  marginRight: 6,
};

function ToolbarButton({ active, onClick, title, children }: { active?: boolean; onClick?: () => void; title?: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={!!active}
      style={{
        ...TOOLBAR_BTN,
        border: active ? "1px solid #0b66ff" : "1px solid #e6e6e6",
        background: active ? "#eef6ff" : "#fff",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 600 }}>{children}</span>
    </button>
  );
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      style={{
        width: 44,
        height: 26,
        borderRadius: 16,
        padding: 2,
        background: checked ? "#0b66ff" : "#e6e6e6",
        border: "none",
        display: "inline-flex",
        alignItems: "center",
        cursor: "pointer",
      }}
    >
      <span
        style={{
          width: 20,
          height: 20,
          borderRadius: 12,
          background: "#fff",
          transform: checked ? "translateX(18px)" : "translateX(0)",
          transition: "transform 120ms ease",
        }}
      />
    </button>
  );
}

export default function BlogPostsModuleAdmin({ manifest }: { manifest?: any }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Post | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // formatting active state
  const [act, setAct] = useState({ bold: false, italic: false, underline: false, ul: false, ol: false });

  useEffect(() => {
    load();
    const onSel = () => updateActive();
    document.addEventListener("selectionchange", onSel);
    return () => document.removeEventListener("selectionchange", onSel);
  }, []);

  useEffect(() => {
    // set editor content when editing changes
    if (!editorRef.current) return;
    if (editing) editorRef.current.innerHTML = editing.content || "";
    else editorRef.current.innerHTML = "";
    updateActive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  function updateActive() {
    try {
      setAct({
        bold: !!document.queryCommandState?.("bold"),
        italic: !!document.queryCommandState?.("italic"),
        underline: !!document.queryCommandState?.("underline"),
        ul: !!document.queryCommandState?.("insertUnorderedList"),
        ol: !!document.queryCommandState?.("insertOrderedList"),
      });
    } catch {
      setAct({ bold: false, italic: false, underline: false, ul: false, ol: false });
    }
  }

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
    const p: Post = {
      title: "",
      slug: "",
      summary: "",
      content: "",
      published: false,
      archived: false,
      share_settings: { x: true, twitter: true, linkedin: false },
    };
    setEditing(p);
    setTimeout(() => editorRef.current && (editorRef.current.innerHTML = ""), 30);
  }

  function startEdit(p: Post) {
    setEditing({ ...p });
    setTimeout(() => {
      if (editorRef.current) editorRef.current.innerHTML = p.content || "";
    }, 30);
  }

  function exec(cmd: string, val?: string) {
    try {
      // prefer styleWithCSS where supported
      document.execCommand("styleWithCSS", false, "true");
    } catch {}
    document.execCommand(cmd as any, false, val);
    if (editing) {
      setEditing({ ...editing, content: editorRef.current?.innerHTML || "" });
    }
    setTimeout(updateActive, 10);
  }

  async function uploadFile(file: File) {
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json?.url) return json.url as string;
    } catch {}
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error("read failed"));
      r.readAsDataURL(file);
    });
  }

  async function handleFiles(files: FileList | File[]) {
    const arr = Array.from(files as any);
    for (const f of arr) {
      if (!(f as File).type.startsWith("image/")) continue;
      try {
        const url = await uploadFile(f as File);
        insertImage(url);
      } catch (err: any) {
        setErrorMessage(String(err?.message || err));
      }
    }
  }

  function insertImage(url: string) {
    if (!editorRef.current) return;
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const img = document.createElement("img");
      img.src = url;
      img.style.maxWidth = "100%";
      img.style.display = "block";
      img.style.margin = "8px 0";
      range.insertNode(img);
      range.setStartAfter(img);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      editorRef.current.insertAdjacentHTML("beforeend", `<img src="${url}" style="max-width:100%;display:block;margin:8px 0"/>`);
    }
    if (editing) setEditing({ ...editing, content: editorRef.current.innerHTML });
  }

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files;
    if (f && f.length) handleFiles(f);
    e.currentTarget.value = "";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    if (e.dataTransfer?.files) handleFiles(e.dataTransfer.files);
  }
  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  async function save() {
    if (!editing) return;
    setBusy(true);
    setErrorMessage(null);
    try {
      const html = editorRef.current?.innerHTML ?? editing.content ?? "";
      const payload = { ...editing, content: html, share_settings: editing.share_settings || {} };
      const method = editing.id ? "PUT" : "POST";
      const url = editing.id ? `/api/modules/blog-posts/admin/${editing.id}` : `/api/modules/blog-posts/admin`;
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
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

  async function toggleArchive(p: Post) {
    if (!p.id) return;
    setBusy(true);
    try {
      const copy = { ...p, archived: !p.archived };
      const res = await fetch(`/api/modules/blog-posts/admin/${p.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(copy),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "archive failed");
      await load();
    } catch (e: any) {
      setErrorMessage(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  const canSave = !!editing && !!(editing.title && editing.slug) && !busy;

  return (
    <div style={{ minHeight: "100vh", padding: 18, background: "#f7f7fb", fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial" }}>
      <main
        style={{
          maxWidth: "100%",
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: `${SIDEBAR_W}px minmax(${EDITOR_MIN}px, 1fr)`,
          gap: 22,
          alignItems: "start",
          padding: "10px 24px",
        }}
      >
        <aside>
          <div style={{ background: "#fff", borderRadius: 12, padding: 14, boxShadow: "0 6px 18px rgba(15,23,42,0.03)", maxHeight: "82vh", overflow: "auto", position: "sticky", top: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>Posts</div>
                <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>{busy ? "Loading…" : `${posts.length} posts`}</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <button onClick={load} style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid #e6e6e6", background: "#fff", fontSize: 13 }}>Refresh</button>
              <button onClick={startNew} style={{ flex: 1, padding: "8px 10px", borderRadius: 8, background: "#111", color: "#fff", fontSize: 13 }}>New</button>
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
                      <button title="Publish/unpublish" onClick={(e) => { e.stopPropagation(); togglePublishPost(p); }} style={{ padding: "6px 8px", fontSize: 13 }}>📤</button>
                      <button title="Archive" onClick={(e) => { e.stopPropagation(); toggleArchive(p); }} style={{ padding: "6px 8px", fontSize: 13 }}>🗄️</button>
                      <button title="Delete" onClick={(e) => { e.stopPropagation(); remove(p.id); }} style={{ padding: "6px 8px", fontSize: 13 }}>🗑️</button>
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

        <section style={{ background: "#fff", borderRadius: 12, padding: 18, boxShadow: "0 6px 18px rgba(15,23,42,0.03)" }}>
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

                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button
                      onClick={save}
                      disabled={!canSave}
                      style={{
                        padding: "8px 14px",
                        background: canSave ? "#0b66ff" : "#cbdcff",
                        color: "#fff",
                        border: "none",
                        borderRadius: 8,
                        fontSize: 14,
                        cursor: canSave ? "pointer" : "default",
                      }}
                    >
                      {busy ? "Saving…" : "Save"}
                    </button>

                    <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "#333" }}>
                      <span style={{ color: "#666" }}>Published</span>
                      <Switch checked={!!editing.published} onChange={(v) => setEditing({ ...editing, published: v })} />
                    </div>
                  </div>
                </div>
              </div>

              <input
                value={editing.summary || ""}
                onChange={(e) => setEditing({ ...editing, summary: e.target.value })}
                placeholder="Summary (optional)"
                style={{ width: "100%", padding: "10px", marginBottom: 14, borderRadius: 8, border: "1px solid #f0f0f0", fontSize: 14 }}
              />

              <div style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <ToolbarButton title="Bold" onClick={() => exec("bold")} active={act.bold}>B</ToolbarButton>
                  <ToolbarButton title="Italic" onClick={() => exec("italic")} active={act.italic}>I</ToolbarButton>
                  <ToolbarButton title="Underline" onClick={() => exec("underline")} active={act.underline}>U</ToolbarButton>

                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <label style={{ fontSize: 13, color: "#444", marginRight: 6 }}>Headings</label>
                    <select onChange={(e) => exec("formatBlock", e.target.value)} defaultValue="" style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #e6e6e6", fontSize: 13 }}>
                      <option value="">Normal</option>
                      <option value="<h1>">H1</option>
                      <option value="<h2>">H2</option>
                      <option value="<h3>">H3</option>
                      <option value="<h4>">H4</option>
                    </select>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <label style={{ fontSize: 13, color: "#444", marginRight: 6 }}>Font</label>
                    <select onChange={(e) => exec("fontName", e.target.value)} defaultValue="" style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #e6e6e6", fontSize: 13 }}>
                      <option value="">Default</option>
                      <option value="Georgia">Georgia</option>
                      <option value="Times New Roman">Times New Roman</option>
                      <option value="Arial">Arial</option>
                      <option value="Verdana">Verdana</option>
                    </select>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <label style={{ fontSize: 13, color: "#444", marginRight: 6 }}>Size</label>
                    <select onChange={(e) => exec("fontSize", e.target.value)} defaultValue="" style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #e6e6e6", fontSize: 13 }}>
                      <option value="">Default</option>
                      <option value="2">Small</option>
                      <option value="3">Normal</option>
                      <option value="4">Large</option>
                      <option value="5">Larger</option>
                    </select>
                  </div>

                  <ToolbarButton title="Bullet list" onClick={() => exec("insertUnorderedList")} active={act.ul}>•</ToolbarButton>
                  <ToolbarButton title="Numbered list" onClick={() => exec("insertOrderedList")} active={act.ol}>1.</ToolbarButton>
                  <ToolbarButton title="Code block" onClick={() => exec("formatBlock", "<pre>")}>{"</>"}</ToolbarButton>
                  <ToolbarButton title="Blockquote" onClick={() => exec("formatBlock", "<blockquote>")}>❝</ToolbarButton>

                  <ToolbarButton title="Insert Link" onClick={() => { const url = prompt("URL for the link"); if (url) exec("createLink", url); }}>🔗</ToolbarButton>

                  <ToolbarButton title="Insert image" onClick={() => fileRef.current?.click()}>🖼️</ToolbarButton>
                </div>
              </div>

              <div onDrop={onDrop} onDragOver={onDragOver} style={{ minHeight: 480, border: "1px solid #eee", borderRadius: 8, padding: 14 }}>
                <div
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={() => setEditing({ ...editing, content: editorRef.current?.innerHTML || "" })}
                  style={{ minHeight: 420, outline: "none", fontSize: 17, lineHeight: 1.7, color: "#111" }}
                  dangerouslySetInnerHTML={{ __html: editing.content || "" }}
                />
              </div>

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

                    {/* new toggles */}
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
          <input type="file" ref={fileRef} accept="image/*" style={{ display: "none" }} onChange={onFileInput} />
          {errorMessage && (
            <div style={{ marginTop: 12, color: "crimson" }}>
              {errorMessage}{" "}
              <button onClick={() => setErrorMessage(null)} style={{ marginLeft: 8 }}>
                Dismiss
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}