// app/api/debug/gist/route.ts
import { NextResponse } from "next/server";
import { fetchNormalizedResume } from "@/lib/gist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const json = await fetchNormalizedResume();
    const basics = (json as any)?.basics ?? {};

    const summary = basics?.summary;
    const info = {
      hasBasics: !!basics,
      basicsKeys: Object.keys(basics || {}),
      summary,
      summaryType: typeof summary,
      summaryLen: typeof summary === "string" ? summary.length : null,
      // sanity check on other basics fields you said do show up:
      name: basics?.name ?? null,
      label: basics?.label ?? null,
      image: basics?.image ?? null,
      profilesCount: Array.isArray(basics?.profiles) ? basics.profiles.length : 0,
    };

    return NextResponse.json(info, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    return NextResponse.json(
      { error: String(e?.message || e) },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
