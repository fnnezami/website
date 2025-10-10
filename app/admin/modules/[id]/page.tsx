import React from "react";
import { notFound } from "next/navigation";
import { loadManifestsWithRegistry } from "@/lib/modules";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ModuleAdminPage({ params }: { params?: { id?: string | Promise<string> } }) {
  const resolvedParams = params ? await params : undefined;
  const segs = resolvedParams?.id ? [resolvedParams.id] : [];
  if (!segs || segs.length === 0) return notFound();

  const moduleId = String(segs[0]);

  // resolve manifest (unchanged)
  let manifest: any = null;
  try {
    const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    const srv = SUPA_URL && SERVICE ? createClient(SUPA_URL, SERVICE) : undefined;
    const all = await loadManifestsWithRegistry(srv as any);
    manifest = all.find((m: any) => m.id === moduleId && m.enabled) || null;
  } catch {
    manifest = null;
  }
  if (!manifest) return notFound();

  // Try to load the module's admin component directly from modules/<id>/admin
  try {
    // server-side import of the module's admin (client component). Path is relative to this file.
    // If your admin file is modules/<id>/admin(.tsx/.ts/.jsx/.js) this should resolve.
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const mod = await import(`../../../../modules/${moduleId}/admin`);
    const AdminComp = mod?.default || mod?.Page;
    if (!AdminComp) {
      return (
        <div className="mx-auto max-w-3xl px-4 py-8">
          <h2>Admin UI not found</h2>
          <p>No client admin component exported from modules/{moduleId}/admin.</p>
        </div>
      );
    }

    // Render the admin component; it is a client component and will hydrate on the client.
    // Pass manifest prop so the module can read its manifest.
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <AdminComp manifest={manifest} />
      </div>
    );
  } catch (err: any) {
    // show helpful debug info so you can fix import path / filename
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h2>Error loading admin for "{moduleId}"</h2>
        <pre style={{ whiteSpace: "pre-wrap", color: "crimson" }}>
          {String(err?.message || err)}
        </pre>
        <p>Checked modules/{moduleId}/admin (ensure the file exists and exports a default client component).</p>
      </div>
    );
  }
}