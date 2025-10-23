"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const checked = theme === "dark";

  useEffect(() => {
    const saved = (typeof window !== "undefined" && localStorage.getItem("theme")) as
      | "light"
      | "dark"
      | null;
    const prefersDark =
      !saved &&
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    const t = saved || (prefersDark ? "dark" : "light");
    document.documentElement.classList.toggle("dark", t === "dark");
    setTheme(t);
  }, []);

  function onToggle(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.checked ? "dark" : "light";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem("theme", next);
    } catch {}
  }

  return (
    <label
      aria-label="Toggle dark mode"
      title="Toggle dark mode"
      style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}
    >
      <span style={{ fontSize: 12, color: "var(--label-color, var(--foreground))" }}>
        {checked ? "Dark" : "Light"}
      </span>
      <span style={{ position: "relative", width: 44, height: 24 }}>
        <input
          type="checkbox"
          role="switch"
          checked={checked}
          onChange={onToggle}
          aria-checked={checked}
          style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
        />
        <span
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 999,
            background: checked ? "var(--primary, #0b66ff)" : "var(--border-color, #d1d5db)",
            transition: "background 120ms ease",
          }}
        />
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: 2,
            left: checked ? 22 : 2,
            width: 20,
            height: 20,
            borderRadius: 999,
            background: "var(--surface, #fff)",
            boxShadow: "0 1px 3px rgba(0,0,0,.3)",
            transition: "left 120ms ease",
          }}
        />
      </span>
    </label>
  );
}