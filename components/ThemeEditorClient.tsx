"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Editor from "@monaco-editor/react";
import { useTheme } from "next-themes";
import { Wand2, Check } from "lucide-react";

type Mode = "light" | "dark";

// ----------------- helpers -----------------
function buildCSS(selector: string, light: string, dark: string) {
  let out = "";
  if (light?.trim())
    out += `/* THEME-EDITOR: selector:${selector} mode:light start */\n${selector} {\n${light.trim()}\n}\n/* THEME-EDITOR: end */\n\n`;
  if (dark?.trim())
    out += `/* THEME-EDITOR: selector:${selector} mode:dark start */\n.dark ${selector} {\n${dark.trim()}\n}\n/* THEME-EDITOR: end */\n\n`;
  return out;
}

function parseExisting(css: string): Map<string, { light?: string; dark?: string }> {
  const map = new Map<string, { light?: string; dark?: string }>();
  const re =
    /\/\*\s*THEME-EDITOR:\s*selector:(.*?)\s*mode:(light|dark)\s*start\s*\*\/([\s\S]*?)\/\*\s*THEME-EDITOR:\s*end\s*\*\//g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    const sel = m[1].trim();
    const mode = m[2].trim() as Mode;
    const block = m[3].trim();
    const body = block
      .replace(new RegExp(`^${sel.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\s*{`), "")
      .replace(/}\s*$/, "")
      .trim();
    const entry = map.get(sel) || {};
    if (mode === "light") entry.light = body;
    else entry.dark = body;
    map.set(sel, entry);
  }
  return map;
}

// drag + resize with pointer events
function useDragResize(
  panelRef: React.RefObject<HTMLDivElement | null>,
  dragHandleRef: React.RefObject<HTMLDivElement | null>,
  resizeHandleRef: React.RefObject<HTMLDivElement | null>,
  opts?: { minW?: number; minH?: number }
) {
  useEffect(() => {
    const panel = panelRef.current;
    const drag = dragHandleRef.current;
    const resize = resizeHandleRef.current;
    if (!panel || !drag || !resize) return;

    const minW = opts?.minW ?? 600;
    const minH = opts?.minH ?? 420;

    let dragging = false;
    let resizing = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;
    let startWidth = 0;
    let startHeight = 0;

    // ensure initial values
    if (!panel.style.left) panel.style.left = "50px";
    if (!panel.style.top) panel.style.top = "100px";
    if (!panel.style.width) panel.style.width = "960px";
    if (!panel.style.height) panel.style.height = "600px";

    const onPointerMove = (e: PointerEvent) => {
      if (dragging) {
        const nx = startLeft + (e.clientX - startX);
        const ny = startTop + (e.clientY - startY);
        const maxX = window.innerWidth - panel.offsetWidth;
        const maxY = window.innerHeight - 48;
        panel.style.left = Math.max(0, Math.min(nx, Math.max(0, maxX))) + "px";
        panel.style.top = Math.max(0, Math.min(ny, Math.max(0, maxY))) + "px";
      } else if (resizing) {
        const nw = Math.max(minW, startWidth + (e.clientX - startX));
        const nh = Math.max(minH, startHeight + (e.clientY - startY));
        panel.style.width = nw + "px";
        panel.style.height = nh + "px";
      }
    };

    const onPointerUp = () => {
      dragging = false;
      resizing = false;
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp, true);
    };

    const onDragDown = (e: PointerEvent) => {
      dragging = true;
      const rect = panel.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      startLeft = rect.left;
      startTop = rect.top;
      document.body.style.userSelect = "none";
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp, true);
    };

    const onResizeDown = (e: PointerEvent) => {
      resizing = true;
      const rect = panel.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      startWidth = rect.width;
      startHeight = rect.height;
      document.body.style.userSelect = "none";
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp, true);
      e.stopPropagation();
    };

    drag.addEventListener("pointerdown", onDragDown);
    resize.addEventListener("pointerdown", onResizeDown);

    return () => {
      drag.removeEventListener("pointerdown", onDragDown);
      resize.removeEventListener("pointerdown", onResizeDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp, true);
      document.body.style.userSelect = "";
    };
  }, [panelRef, dragHandleRef, resizeHandleRef, opts]);
}

// bold button fallbacks (ensure they LOOK like buttons)
const buttonPrimaryStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid var(--primary)",
  background: "var(--primary)",
  color: "var(--primary-foreground)",
  fontWeight: 700,
  cursor: "pointer",
};
const buttonSecondaryStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid var(--input)",
  background: "var(--surface)",
  color: "var(--foreground)",
  fontWeight: 700,
  cursor: "pointer",
};

// ----------------- component -----------------
export default function ThemeEditorClient() {
  // states
  const [mounted, setMounted] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [selecting, setSelecting] = useState(false);

  const [selectedEl, setSelectedEl] = useState<HTMLElement | null>(null);
  const [selector, setSelector] = useState<string>("");
  const [classes, setClasses] = useState<string[]>([]);
  const [tab, setTab] = useState<Mode>("light");

  const [lightCSS, setLightCSS] = useState<string>("");
  const [darkCSS, setDarkCSS] = useState<string>("");
  const [originalLightCSS, setOriginalLightCSS] = useState<string>("");
  const [originalDarkCSS, setOriginalDarkCSS] = useState<string>("");

  const [computedCSS, setComputedCSS] = useState<string>("");
  const [allOverrides, setAllOverrides] = useState<string>("");

  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const { theme } = useTheme();

  // refs
  const inspectorRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const resizeRef = useRef<HTMLDivElement | null>(null);
  const liveStyleRef = useRef<HTMLStyleElement | null>(null);
  const hoverStyleRef = useRef<HTMLStyleElement | null>(null);

  // behaviors
  useDragResize(inspectorRef, headerRef, resizeRef, { minW: 600, minH: 420 });

  // mount
  useEffect(() => setMounted(true), []);

  // create in-memory style tags
  useEffect(() => {
    if (!mounted) return;
    let live = document.getElementById("theme-editor-live") as HTMLStyleElement | null;
    if (!live) {
      live = document.createElement("style");
      live.id = "theme-editor-live";
      document.head.appendChild(live);
    }
    liveStyleRef.current = live;

    let hover = document.getElementById("theme-editor-hover") as HTMLStyleElement | null;
    if (!hover) {
      hover = document.createElement("style");
      hover.id = "theme-editor-hover";
      document.head.appendChild(hover);
    }
    hoverStyleRef.current = hover;
  }, [mounted]);

  // load saved overrides
  useEffect(() => {
    if (!mounted) return;
    (async () => {
      const css = await fetch("/admin/api/theme/overrides", { cache: "no-store" }).then((r) => r.text());
      setAllOverrides(css);
    })();
  }, [mounted]);

  // selection mode
  useEffect(() => {
    if (!mounted || !selecting) {
      if (hoverStyleRef.current) hoverStyleRef.current.textContent = "";
      return;
    }

    const onMove = (e: MouseEvent) => {
      const tgt = e.target as HTMLElement;
      if (tgt.closest("#theme-inspector") || tgt.closest("#theme-fab")) return;
      if (hoverStyleRef.current) {
        hoverStyleRef.current.textContent =
          `[data-te-hover]{outline:2px dashed var(--ring)!important;outline-offset:2px!important;cursor:crosshair!important;}`;
      }
      document.querySelectorAll("[data-te-hover]").forEach((el) => el.removeAttribute("data-te-hover"));
      tgt.setAttribute("data-te-hover", "");
    };

    const onClick = (e: MouseEvent) => {
      const tgt = e.target as HTMLElement;
      if (tgt.closest("#theme-inspector") || tgt.closest("#theme-fab")) return;
      e.preventDefault();
      e.stopPropagation();
      selectElement(tgt);
      setSelecting(false);
      setInspectorOpen(true);
    };

    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("click", onClick, true);

    return () => {
      document.removeEventListener("mousemove", onMove, true);
      document.removeEventListener("click", onClick, true);
      if (hoverStyleRef.current) hoverStyleRef.current.textContent = "";
      document.querySelectorAll("[data-te-hover]").forEach((el) => el.removeAttribute("data-te-hover"));
    };
  }, [mounted, selecting]);

  function selectElement(el: HTMLElement) {
    setSelectedEl(el);
    const tag = el.tagName.toLowerCase();
    setSelector(tag);
    setClasses(Array.from(el.classList));

    // load existing css for tag
    const parsed = parseExisting(allOverrides);
    const found = parsed.get(tag);
    const light = found?.light || "";
    const dark = found?.dark || "";

    setLightCSS(light);
    setDarkCSS(dark);
    setOriginalLightCSS(light);
    setOriginalDarkCSS(dark);

    // computed preview
    const cs = getComputedStyle(el);
    const props = Array.from(cs).map((n) => [n, cs.getPropertyValue(n).trim()] as [string, string]);
    const important = new Set([
      "color",
      "background-color",
      "font-size",
      "font-weight",
      "font-family",
      "line-height",
      "border",
      "border-radius",
      "outline",
      "box-shadow",
      "padding",
      "margin",
      "gap",
      "display",
      "width",
      "height",
    ]);
    const ordered = [...props.filter(([n]) => important.has(n)), ...props.filter(([n]) => !important.has(n)).slice(0, 120)];
    setComputedCSS(ordered.map(([n, v]) => `${n}: ${v};`).join("\n"));

    // highlight target briefly
    el.style.outline = "2px dashed var(--ring)";
    el.style.outlineOffset = "4px";
    setTimeout(() => {
      el.style.outline = "";
      el.style.outlineOffset = "";
    }, 1200);
  }

  // live in-memory CSS injection
  useEffect(() => {
    if (!selector || !liveStyleRef.current) return;
    const parsed = parseExisting(allOverrides);
    parsed.set(selector, { light: lightCSS, dark: darkCSS });
    let out = "";
    parsed.forEach((val, sel) => {
      out += buildCSS(sel, val.light || "", val.dark || "");
    });
    liveStyleRef.current.textContent = out;
  }, [selector, lightCSS, darkCSS, allOverrides]);

  async function onSave() {
    if (!selector) return;
    try {
      setSaveStatus("saving");
      const parsed = parseExisting(allOverrides);
      parsed.set(selector, { light: lightCSS, dark: darkCSS });
      let out = "";
      parsed.forEach((val, sel) => {
        out += buildCSS(sel, val.light || "", val.dark || "");
      });
      await fetch("/admin/api/theme/overrides", { method: "POST", body: out });
      setAllOverrides(out);
      setOriginalLightCSS(lightCSS);
      setOriginalDarkCSS(darkCSS);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 1200);
    } catch {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 1500);
    }
  }

  async function onDiscard() {
    if (!selector) return;
    const css = await fetch("/admin/api/theme/overrides", { cache: "no-store" }).then((r) => r.text());
    setAllOverrides(css);
    const parsed = parseExisting(css);
    const found = parsed.get(selector);
    const light = found?.light || "";
    const dark = found?.dark || "";
    setLightCSS(light);
    setDarkCSS(dark);
    setOriginalLightCSS(light);
    setOriginalDarkCSS(dark);

    // rebuild live
    let out = "";
    parsed.forEach((val, sel) => {
      out += buildCSS(sel, val.light || "", val.dark || "");
    });
    if (liveStyleRef.current) liveStyleRef.current.textContent = out;
  }

  const hasUnsavedChanges = lightCSS !== originalLightCSS || darkCSS !== originalDarkCSS;
  const monacoTheme = theme === "dark" ? "vs-dark" : "vs-light";

  // final render gating (keeps hook order stable)
  return mounted
    ? createPortal(
        <>
          {/* Floating button (smaller) */}
          <div
            id="theme-fab"
            style={{
              position: "fixed",
              bottom: 18,
              right: 18,
              zIndex: 9998,
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: 8,
            }}
          >
            {hasUnsavedChanges && (
              <div
                style={{
                  background: "var(--popover)",
                  color: "var(--foreground)",
                  padding: "6px 10px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  border: "1px solid var(--input)",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                }}
              >
                Unsaved changes
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                if (inspectorOpen) setInspectorOpen(false);
                else setSelecting(true);
              }}
              style={{
                width: 46,
                height: 46,
                borderRadius: 999,
                background: "var(--primary)",
                color: "var(--primary-foreground)",
                border: "1px solid var(--primary)",
                cursor: "pointer",
                boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "transform 0.2s, box-shadow 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.05)";
                e.currentTarget.style.boxShadow = "0 12px 32px rgba(0,0,0,0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.25)";
              }}
              title="Theme Editor"
              aria-label="Theme Editor"
            >
              {selecting ? <span style={{ fontSize: 18, lineHeight: 1 }}>✕</span> : <Wand2 size={20} strokeWidth={2.4} />}
            </button>
          </div>

          {/* Inspector (moveable + resizable) */}
          {inspectorOpen && selectedEl && (
            <div
              id="theme-inspector"
              ref={inspectorRef}
              style={{
                position: "fixed",
                left: 50,
                top: 100,
                width: 960,
                height: 600,
                background: "var(--popover)",
                color: "var(--foreground)",
                borderRadius: 12,
                border: "1px solid var(--input)",
                boxShadow: "0 20px 60px rgba(0,0,0,.3)",
                display: "grid",
                gridTemplateRows: "auto auto 1fr auto",
                overflow: "hidden",
                zIndex: 9999,
              }}
            >
              {/* Header = drag handle */}
              <div
                ref={headerRef}
                className="inspector-header"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: 12,
                  cursor: "move",
                  userSelect: "none",
                  borderBottom: "1px solid var(--input)",
                  background: "var(--card)",
                  borderRadius: "12px 12px 0 0",
                }}
              >
                <div style={{ fontWeight: 800, fontSize: 15 }}>&lt;{selector}&gt;</div>
                {classes.length > 0 && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {classes.map((c) => (
                      <span
                        key={c}
                        style={{
                          fontSize: 11,
                          padding: "3px 8px",
                          borderRadius: 6,
                          background: "var(--surface)",
                          border: "1px solid var(--input)",
                          fontFamily: "monospace",
                        }}
                      >
                        .{c}
                      </span>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setInspectorOpen(false)}
                  style={{ marginLeft: "auto", ...buttonSecondaryStyle }}
                >
                  Close
                </button>
              </div>

              {/* Mode switch (Light/Dark) */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, background: "var(--card)" }}>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 12, opacity: 0.85 }}>Light</span>
                  <span
                    style={{
                      position: "relative",
                      width: 48,
                      height: 26,
                      borderRadius: 999,
                      background: tab === "dark" ? "var(--primary)" : "var(--input)",
                      transition: "background .15s",
                      border: "1px solid var(--input)",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={tab === "dark"}
                      onChange={(e) => setTab(e.target.checked ? "dark" : "light")}
                      aria-label="Toggle dark mode editing"
                      style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
                    />
                    <span
                      style={{
                        position: "absolute",
                        top: 2,
                        left: tab === "dark" ? 26 : 2,
                        width: 22,
                        height: 22,
                        borderRadius: 999,
                        background: "var(--card)",
                        boxShadow: "0 1px 3px rgba(0,0,0,.25)",
                        transition: "left .15s",
                      }}
                    />
                  </span>
                  <span style={{ fontSize: 12, opacity: 0.85 }}>Dark</span>
                </label>

                <span style={{ fontSize: 12, opacity: 0.8 }}>
                  Mode: {tab === "dark" ? "Dark" : "Light"} — edits apply live to{" "}
                  <code style={{ background: "var(--surface)", padding: "2px 6px", borderRadius: 4 }}>&lt;{selector}&gt;</code>
                </span>
              </div>

              {/* Editors */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", minHeight: 0 }}>
                <div style={{ display: "grid", gridTemplateRows: "auto 1fr", borderRight: "1px solid var(--input)" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, padding: "10px 12px", background: "var(--card)", borderBottom: "1px solid var(--input)" }}>
                    Your CSS ({tab})
                  </div>
                  <div style={{ minHeight: 0, overflow: "hidden" }}>
                    <Editor
                      height="100%"
                      language="css"
                      value={tab === "light" ? lightCSS : darkCSS}
                      onChange={(val) => (tab === "light" ? setLightCSS(val || "") : setDarkCSS(val || ""))}
                      theme={monacoTheme}
                      options={{
                        minimap: { enabled: false },
                        fontSize: 13,
                        lineNumbers: "on",
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        tabSize: 2,
                        wordWrap: "on",
                        padding: { top: 8, bottom: 8 },
                      }}
                    />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateRows: "auto 1fr" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, padding: "10px 12px", background: "var(--card)", borderBottom: "1px solid var(--input)" }}>
                    Computed Styles (read-only)
                  </div>
                  <div style={{ minHeight: 0, overflow: "hidden" }}>
                    <Editor
                      height="100%"
                      language="css"
                      value={computedCSS}
                      theme={monacoTheme}
                      options={{
                        readOnly: true,
                        minimap: { enabled: false },
                        fontSize: 12,
                        lineNumbers: "off",
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        wordWrap: "on",
                        padding: { top: 8, bottom: 8 },
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Footer actions */}
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  padding: 12,
                  borderTop: "1px solid var(--input)",
                  background: "var(--card)",
                  borderRadius: "0 0 12px 12px",
                }}
              >
                <button
                  type="button"
                  onClick={onSave}
                  className="btn"
                  style={{
                    ...buttonPrimaryStyle,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    opacity: saveStatus === "saving" ? 0.85 : 1,
                  }}
                  disabled={saveStatus === "saving"}
                >
                  {saveStatus === "saved" ? <Check size={16} /> : null}
                  {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved" : "Save"}
                </button>
                <button type="button" onClick={onDiscard} className="btn-secondary" style={{ ...buttonSecondaryStyle }}>
                  Discard
                </button>
                {saveStatus === "error" && (
                  <span style={{ color: "var(--destructive, #dc2626)", fontWeight: 700, marginLeft: 6 }}>Save failed</span>
                )}
              </div>

              {/* Resize handle */}
              <div
                ref={resizeRef}
                style={{
                  position: "absolute",
                  right: 0,
                  bottom: 0,
                  width: 18,
                  height: 18,
                  cursor: "nwse-resize",
                  background: "linear-gradient(135deg, transparent 50%, var(--input) 50%)",
                  borderRadius: "0 0 12px 0",
                }}
              />
            </div>
          )}
        </>,
        document.body
      )
    : null;
}