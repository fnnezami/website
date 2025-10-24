"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const ThemeEditorClient = dynamic(() => import("./ThemeEditorClient"), { ssr: false });

export default function ThemeEditorWrapper() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const read = () => setEnabled(localStorage.getItem("theme-editor-enabled") === "true");
    read();
    const onStorage = (e: StorageEvent) => {
      if (e.key === "theme-editor-enabled") read();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  if (!enabled) return null;
  return <ThemeEditorClient />;
}