"use client";
import { useEffect, useState } from "react";
import { BlockRegistry } from "@/lib/blocks/registry";

// We’ll fetch enabled floating modules via an API (no SSR flash)
export default function FloatingModulesHost() {
  const [mods, setMods] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/modules/floating", { cache: "no-store" });
        const j = await r.json();
        if (Array.isArray(j?.modules)) setMods(j.modules);
      } catch {}
    })();
  }, []);

  return (
    <>
      {mods.map((m) => {
        const blk = m?.config?.block;
        if (!blk?.type) return null;
        const Cmp = BlockRegistry[blk.type as keyof typeof BlockRegistry];
        if (!Cmp) return null;
        return (
          <div key={m.id} className="fixed bottom-4 right-4 z-50">
            <Cmp {...(blk.props || {})} />
          </div>
        );
      })}
    </>
  );
}
