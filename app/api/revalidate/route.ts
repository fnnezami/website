import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { paths } = await req.json();
    const list: string[] = Array.isArray(paths) ? paths : [];
    for (const p of list) {
      if (typeof p === "string" && p.startsWith("/")) {
        revalidatePath(p);
      }
    }
    return NextResponse.json({ ok: true, revalidated: list });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
