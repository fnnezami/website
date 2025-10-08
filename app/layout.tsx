// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import ProfileHeader from "@/components/ProfileHeader";
import Navbar from "@/components/Navbar";
import { fetchNormalizedResume } from "@/lib/gist";

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
  // Pull a few basics for header; safe-guard if gist is down
  let basics: any = {};
  try {
    const data = await fetchNormalizedResume();
    basics = data?.basics || {};
  } catch {
    basics = {};
  }

  // EXACT: use basics.summary only (trimmed). No placeholders.
  const aboutText =
    typeof basics?.summary === "string" ? basics.summary.trim() : "";

  const links: { label: string; href: string }[] = [
    ...(basics?.url ? [{ label: "Website", href: String(basics.url) }] : []),
    ...(
      Array.isArray(basics?.profiles)
        ? basics.profiles
            .filter((p: any) => p && p.url)
            .map((p: any) => ({
              label: String(p.network || "Profile"),
              href: String(p.url),
            }))
        : []
    ),
  ];

  return (
    <html lang="en">
      <body className="bg-neutral-50 text-neutral-900">
        <ProfileHeader
          name={String(basics?.name || "Your Name")}
          title={String(basics?.label || "")}
          about={aboutText}
          photoUrl={typeof basics?.image === "string" ? basics.image : undefined}
          links={links}
        />

        {/* Offset variable helps keep Navbar stuck below header’s height */}
        <div style={{ ["--nav-offset" as any]: "8.25rem" }}>
          <Navbar />
        </div>

        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
