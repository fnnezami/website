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
import ThemeToggle from "./components/ThemeToggle.client";

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
      <body className="bg-background text-foreground">
        {/* Thin sticky top bar only */}
        <header className="site-header sticky top-0 z-40 border-b" style={{
          background: "color-mix(in oklab, var(--background) 85%, transparent)",
          backdropFilter: "saturate(140%) blur(8px)",
          WebkitBackdropFilter: "saturate(140%) blur(8px)",
          borderColor: "var(--border-color)",
        }}>
          <div className="mx-auto max-w-6xl" style={{ padding: "10px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {/* Brand / Name (kept compact) */}
              <div style={{ fontWeight: 700 }}>
                {String(basics?.name || "Your Name")}
              </div>

              {/* Nav */}
              <nav style={{ marginLeft: 12 }}>
                <Navbar pageModules={pageModules} />
              </nav>

              {/* Actions */}
              <div style={{ marginLeft: "auto" }}>
                <ThemeToggle />
              </div>
            </div>
          </div>
        </header>

        {/* Non-sticky profile intro (so header stays thin) */}
        <div className="mx-auto max-w-6xl" style={{ padding: "12px 16px 0 16px" }}>
          <ProfileHeader
            name={String(basics?.name || "")}
            title={String(basics?.label || "")}
            about={typeof basics?.summary === "string" ? basics.summary : ""}
            summary={typeof basics?.summary === "string" ? basics.summary : ""}
            photoUrl={typeof basics?.image === "string" ? basics.image : undefined}
            links={links}
            // Tighten summary block to prevent tall header feel
          />
        </div>

        {/* Content */}
        <main className="mx-auto max-w-6xl" style={{ padding: "16px" }}>
          {children}
        </main>

        <FloatingModulesServer />
      </body>
    </html>
  );
}
