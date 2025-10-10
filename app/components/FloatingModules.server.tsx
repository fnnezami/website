import React from "react";
import ModuleClientLoader from "./ModuleClientLoader";
import { getEnabledFloatingModules } from "@/lib/modules";
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

export default async function FloatingModulesServer() {
  const mods = (await getEnabledFloatingModules()) || [];

  const items: {
    id: string;
    manifest: any;
    serverComp?: React.ComponentType<any>;
    clientFile?: string;
  }[] = [];

  const modulesDir = path.join(process.cwd(), "modules");

  for (const m of mods) {
    try {
      if (!m || m.enabled === false || String(m.kind) !== "floating") continue;
      const id = String(m.id);
      const modPublic = path.join(modulesDir, id, "public");

      // prefer server widget filenames
      const serverCandidates = ["widget.server.tsx", "widget.server.ts", "widget.server.jsx", "widget.server.js", "widget.server.mjs"];
      let serverPath: string | null = null;
      for (const c of serverCandidates) {
        const p = path.join(modPublic, c);
        if (fs.existsSync(p) && fs.statSync(p).isFile()) { serverPath = p; break; }
      }

      if (serverPath) {
        // load server component dynamically (avoid bundler static analysis)
        try {
          const imp = await import(pathToFileURL(serverPath).href);
          const Comp = imp?.default || imp;
          if (typeof Comp === "function" || typeof Comp === "object") {
            items.push({ id, manifest: m, serverComp: Comp });
            continue;
          }
        } catch (e) {
          // fallthrough to client loader if server import fails
          console.error("Failed to import server widget", id, e);
        }
      }

      // client widget candidates
      const clientCandidates = ["widget.js", "widget.mjs", "widget.jsx", "widget.tsx", "widget.ts"];
      let clientFound: string | null = null;
      for (const c of clientCandidates) {
        const p = path.join(modPublic, c);
        if (fs.existsSync(p) && fs.statSync(p).isFile()) { clientFound = c; break; }
      }
      if (clientFound) {
        items.push({ id, manifest: m, clientFile: clientFound });
        continue;
      }

      // fallback: maybe widget is exported from a different path declared in manifest.config.widgetFile
      const cfgFile = m?.config?.widgetFile;
      if (cfgFile) {
        const p = path.join(modPublic, cfgFile);
        if (fs.existsSync(p) && fs.statSync(p).isFile()) {
          items.push({ id, manifest: m, clientFile: cfgFile });
          continue;
        }
      }
    } catch (e) {
      console.error("error discovering widget for module", m?.id, e);
    }
  }

  return (
    <>
      {items.map((it) =>
        it.serverComp ? (
          // server component rendered directly
          <React.Fragment key={it.id}>
            {/* server widget may expect manifest prop */}
            {React.createElement(it.serverComp as any, { manifest: it.manifest })}
          </React.Fragment>
        ) : (
          // client loader that injects <script src="/api/modules/public?module=...&file=...">
          <ModuleClientLoader key={it.id} moduleId={it.id} manifest={it.manifest} file={it.clientFile || "widget.js"} />
        )
      )}
    </>
  );
}