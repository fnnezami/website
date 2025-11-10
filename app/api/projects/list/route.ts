import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const origin = new URL(req.url).origin;

    // 1) CV projects
    let cv: any[] = [];
    try {
      const r = await fetch(`${origin}/api/cv-projects`, { cache: "no-store" });
      const data = await r.json();
      cv = Array.isArray(data.projects) ? data.projects : [];
    } catch {
      cv = [];
    }

    // 2) Custom projects
    const { data: customRows, error } = await supabaseAdmin
      .from("project_details")
      .select("slug,title,is_custom,updated_at")
      .eq("is_custom", true)
      .order("updated_at", { ascending: false });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    const custom = (customRows || []).map((r) => ({
      slug: r.slug,
      name: r.title || r.slug,
      source: "custom" as const,
    }));

    // 3) Merge (custom overrides CV with same slug)
    const map = new Map<string, { slug: string; name: string; source: "cv" | "custom" }>();
    for (const p of cv) {
      map.set(p.slug, { slug: p.slug, name: p.name || p.slug, source: "cv" });
    }
    for (const p of custom) {
      map.set(p.slug, p); // override
    }

    const combined = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    return NextResponse.json({ ok: true, projects: combined }, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed to list projects" }, { status: 500 });
  }
}