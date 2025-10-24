"use client";

import { useState, useEffect } from "react";

export default function ThemeEditorToggle() {
  const [enabled, setEnabled] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const current = localStorage.getItem("theme-editor-enabled") === "true";
    setEnabled(current);
  }, []);

  function toggle(val: boolean) {
    setEnabled(val);
    localStorage.setItem("theme-editor-enabled", val ? "true" : "false");
    window.location.reload();
  }

  if (!mounted) {
    return (
      <div style={{ padding: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 16 }}>Theme Editor</h1>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 600 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 16 }}>Theme Editor</h1>
      <p style={{ marginBottom: 20, opacity: 0.9, lineHeight: 1.6 }}>
        Enable theme editing mode to inspect and style elements across the entire site. A floating inspector button will appear on all pages.
      </p>

      <label style={{ display: "inline-flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
        <span style={{ fontSize: 15, fontWeight: 600 }}>Theme Editor</span>
        <span
          className="switch-track"
          style={{
            position: "relative",
            width: 52,
            height: 28,
            borderRadius: 999,
            background: enabled ? "var(--primary)" : "var(--secondary)",
            transition: "background 0.2s",
          }}
        >
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => toggle(e.target.checked)}
            style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
          />
          <span
            className="switch-thumb"
            style={{
              position: "absolute",
              top: 3,
              left: enabled ? 26 : 3,
              width: 22,
              height: 22,
              borderRadius: 999,
              background: "var(--card)",
              transition: "left 0.2s ease",
              boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
            }}
          />
        </span>
        <span style={{ fontSize: 13, opacity: 0.8 }}>{enabled ? "Enabled" : "Disabled"}</span>
      </label>

      {enabled && (
        <div
          style={{
            marginTop: 20,
            padding: 16,
            background: "var(--surface)",
            borderRadius: 12,
            border: "1px solid var(--input)",
          }}
        >
          <p style={{ fontSize: 14, margin: 0, lineHeight: 1.6 }}>
            ✓ Theme editor is active. Navigate to any page on your site and click the floating 🎨 button to select and inspect elements.
          </p>
        </div>
      )}
    </div>
  );
}