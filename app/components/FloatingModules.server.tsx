import React from "react";
import ModuleClientLoader from "./ModuleClientLoader";
import { getEnabledFloatingModules } from "@/lib/modules";
import path from "path";

// Server component: discover enabled floating modules from DB and render client loader for each.
// NOTE: we intentionally do NOT dynamic-import server widget files here (that causes bundler warnings).
export default async function FloatingModulesServer() {
  const mods = (await getEnabledFloatingModules()) || [];
  const modulesDir = path.join(process.cwd(), "modules");

  const items = mods
    .filter((m: any) => m && m.enabled !== false && String(m.kind) === "floating")
    .map((m: any) => {
      // allow manifest to override widget filename via config.widgetFile, default to widget.js
      const widgetFile = m?.config?.widgetFile || "widget.js";
      return { id: String(m.id), manifest: m, file: widgetFile };
    });

  return (
    <>
      {items.map((it) => (
        <ModuleClientLoader key={it.id} moduleId={it.id} file={it.file} manifest={it.manifest} />
      ))}
    </>
  );
}