import { NextResponse } from "next/server";
import { getEnabledFloatingModules } from "@/lib/modules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const mods = await getEnabledFloatingModules();
  // Send only what the client needs (avoid leaking internals)
  const safe = mods.map((m) => ({
    id: m.id,
    config: m.config, // expected: { block: { type: "...", props: {...} } }
  }));
  return NextResponse.json({ modules: safe }, { headers: { "Cache-Control": "no-store" } });
}
