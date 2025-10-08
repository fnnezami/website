// /app/api/publications/route.ts
import { NextResponse } from "next/server";
import { getEnrichedPublications } from "@/lib/publications";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const debug = url.searchParams.get("debug") === "1";
  const publications = await getEnrichedPublications(debug);
  return NextResponse.json({ publications }, { headers: { "Cache-Control": "no-store" } });
}
