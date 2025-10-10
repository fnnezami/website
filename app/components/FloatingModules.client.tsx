"use client";
import React, { useEffect } from "react";

export default function FloatingModulesClient({ modules }: { modules: any[] }) {
  useEffect(() => {
    const addedScripts: HTMLScriptElement[] = [];

    modules.forEach((m) => {
      if (!m || m.enabled === false || String(m.kind) !== "floating") return;
      const id = String(m.id);
      const widgetFile = m.config?.widgetFile || "widget.js";
      const src = `/api/modules/public?module=${encodeURIComponent(id)}&file=${encodeURIComponent(widgetFile)}`;

      // avoid adding duplicate script tags
      if (document.querySelector(`script[data-module="${id}"]`)) return;

      // create container where module script should mount UI
      const mountId = `module-widget-${id}`;
      if (!document.getElementById(mountId)) {
        const container = document.createElement("div");
        container.id = mountId;
        // optional: add a data attribute with module id/manifest
        (container as any).dataset.module = id;
        document.body.appendChild(container);
      }

      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.setAttribute("data-module", id);
      s.onerror = () => {
        console.error("Failed to load module widget:", id, src);
      };
      document.body.appendChild(s);
      addedScripts.push(s);
    });

    return () => {
      // cleanup scripts and containers on unmount
      addedScripts.forEach((s) => {
        try { s.remove(); } catch {}
        const id = s.getAttribute("data-module");
        if (id) {
          const mount = document.getElementById(`module-widget-${id}`);
          if (mount) mount.remove();
        }
      });
    };
  }, [modules]);

  return null;
}