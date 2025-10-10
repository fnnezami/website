"use client";
import React, { useEffect } from "react";

export default function ModuleClientLoader({ moduleId, file, manifest }: { moduleId: string; file: string; manifest?: any }) {
  useEffect(() => {
    const id = String(moduleId);
    const mountId = `module-widget-${id}`;
    if (!document.getElementById(mountId)) {
      const c = document.createElement("div");
      c.id = mountId;
      document.body.appendChild(c);
    }

    // avoid duplicate script
    const existing = document.querySelector(`script[data-module="${id}"]`);
    if (!existing) {
      const s = document.createElement("script");
      s.src = `/api/modules/public?module=${encodeURIComponent(id)}&file=${encodeURIComponent(file)}`;
      s.async = true;
      s.setAttribute("data-module", id);
      s.onerror = () => console.error("Failed to load widget", id, s.src);
      document.body.appendChild(s);
    }

    return () => {
      // do not aggressively remove the container/script on unmount to avoid flashing during navigation,
      // but you can remove them if you prefer cleanup:
      // document.querySelector(`script[data-module="${id}"]`)?.remove();
      // document.getElementById(mountId)?.remove();
    };
  }, [moduleId, file]);

  return null;
}