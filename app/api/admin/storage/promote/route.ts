// app/api/admin/storage/promote/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Remove query/hash (e.g., ?v=..., #...) and trim spaces
function cleanUrl(u: string) {
  if (!u) return "";
  try {
    const url = new URL(u);
    return `${url.origin}${url.pathname}`;
  } catch {
    // not an absolute URL; if someone passed a key or relative path
    return String(u).split("?")[0].split("#")[0].trim();
  }
}

/**
 * Minimal, robust "promote" that just passes through the provided URLs,
 * but cleans them to avoid broken links (strips ?v=... etc).
 *
 * Body: { slug: string, coverDraftUrl?: string, galleryDraftUrls?: string[] }
 * Returns: { ok: true, coverFinalUrl?: string, galleryFinalUrls?: string[] }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const slug = String(body.slug || "").trim();
    if (!slug) {
      return NextResponse.json({ ok: false, error: "slug required" }, { status: 400 });
    }

    const coverDraftUrl = typeof body.coverDraftUrl === "string" ? cleanUrl(body.coverDraftUrl) : "";
    const galleryDraftUrls = Array.isArray(body.galleryDraftUrls)
      ? (body.galleryDraftUrls as string[])
          .map((u) => cleanUrl(String(u || "")))
          .filter(Boolean)
      : [];

    const result: { coverFinalUrl?: string; galleryFinalUrls?: string[] } = {};
    if (coverDraftUrl) result.coverFinalUrl = coverDraftUrl;
    if (galleryDraftUrls.length) result.galleryFinalUrls = galleryDraftUrls;

    return NextResponse.json(
      { ok: true, ...result },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
