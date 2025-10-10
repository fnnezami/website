"use client";
import React, { useEffect } from "react";

export default function ModuleClientLoader({
  moduleId,
  file,
  manifest,
}: {
  moduleId: string;
  file: string;
  manifest?: any;
}) {
  useEffect(() => {
    const id = String(moduleId);
    const mountId = `module-widget-${id}`;
    if (!document.getElementById(mountId)) {
      const container = document.createElement("div");
      container.id = mountId;
      // optional: attach manifest as JSON on the container for the widget script to read
      if (manifest) container.setAttribute("data-manifest", JSON.stringify(manifest));
      document.body.appendChild(container);
    }

    // avoid duplicate script tags
    if (document.querySelector(`script[data-module="${id}"]`)) return;

    const src = `/api/modules/public?module=${encodeURIComponent(id)}&file=${encodeURIComponent(file)}`;
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.setAttribute("data-module", id);
    s.onerror = () => {
      // keep this console error to help debugging if a widget fails to load
      // but do not throw — failing widget should not break the page
      // eslint-disable-next-line no-console
      console.error("Failed to load module widget", id, src);
    };
    document.body.appendChild(s);

    return () => {
      // optional cleanup: do not aggressively remove script/container on navigation to avoid flash.
    };
  }, [moduleId, file, manifest]);

  return null;
}