// app/api/admin/project-details/route.ts
import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jerr(message: string, status = 500) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const slug = String(body.slug || "").trim();
    const content_md = typeof body.content_md === "string" ? body.content_md : null;
    const cover_image = typeof body.cover_image === "string" ? body.cover_image : null;
    const gallery = Array.isArray(body.gallery) ? body.gallery : [];

    if (!slug) return jerr("slug is required", 400);

    const supabase = getSupabaseServer(); // ✅ create client at call time

    const { error } = await supabase
      .from("project_details")
      .upsert(
        {
          slug,
          content_md,
          cover_image,
          gallery,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "slug" }
      );

    if (error) return jerr(error.message, 500);

    // Success
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return jerr(String(e?.message || e), 500);
  }
}
