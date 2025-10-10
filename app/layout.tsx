// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import ProfileHeader from "@/components/ProfileHeader";
import Navbar from "@/components/Navbar";
import { fetchNormalizedResume } from "@/lib/gist";
import FloatingModulesHost from "@/components/FloatingModulesHost";
import FloatingModulesServer from "./components/FloatingModules.server";
import { loadManifestsWithRegistry } from "@/lib/modules";
import { createClient } from "@supabase/supabase-js";

export const metadata: Metadata = {
  title: "Farbod Nosrat Nezami",
  description: "Resume, publications, and projects",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let basics: any = {};
  try {
    const data = await fetchNormalizedResume();
    basics = data?.basics || {};
  } catch {
    basics = {};
  }

  const links: { label: string; href: string }[] = [
    ...(basics?.url ? [{ label: "Website", href: String(basics.url) }] : []),
    ...(Array.isArray(basics?.profiles) ? basics.profiles : [])
      .filter((p: any) => p && p.url)
      .map((p: any) => ({
        label: String(p.network || "Profile"),
        href: String(p.url),
      })),
  ];

  // load enabled "page" modules and pass to Navbar
  let pageModules: any[] = [];
  try {
    const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    const srv = SUPA_URL && SERVICE ? createClient(SUPA_URL, SERVICE) : undefined;
    const all = await loadManifestsWithRegistry(srv as any);
    pageModules = Array.isArray(all) ? all.filter((m: any) => m.kind === "page" && m.enabled) : [];
  } catch {
    pageModules = [];
  }

  return (
    <html lang="en">
      <body className="bg-neutral-50 text-neutral-900">
        <ProfileHeader
          name={String(basics?.name || "Your Name")}
          title={String(basics?.label || "")}
          about={typeof basics?.summary === "string" ? basics.summary : ""}     
          summary={typeof basics?.summary === "string" ? basics.summary : ""}   
          photoUrl={typeof basics?.image === "string" ? basics.image : undefined}
          links={links}
        />
        <div style={{ ["--nav-offset" as any]: "8.25rem" }}>
          <Navbar pageModules={pageModules} />
        </div>
        {/** other site content */}
        <FloatingModulesServer />
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
