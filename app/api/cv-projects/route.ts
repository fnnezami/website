// /app/api/cv-projects/route.ts
import { NextResponse } from "next/server";
import { fetchNormalizedResume } from "@/lib/gist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toSlug(title: string) {
  return (title || "")
    .toLowerCase()
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function GET() {
  try {
    const resume = await fetchNormalizedResume();
    const raw: any[] = Array.isArray(resume?.projects) ? resume.projects : [];
    const projects = raw
      .filter((p) => p?.name?.trim())
      .map((p) => ({
        slug: toSlug(p.name),
        name: p.name,
        summary: p.summary || p.description || "",
      }));

    return NextResponse.json(
      { ok: true, projects },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
