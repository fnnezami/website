// /app/api/debug/gist/route.ts
import { NextResponse } from "next/server";
import { fetchNormalizedResume } from "@/lib/gist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const json = await fetchNormalizedResume();
    return NextResponse.json({ ok: true, sampleKeys: Object.keys(json || {}).slice(0, 10) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
