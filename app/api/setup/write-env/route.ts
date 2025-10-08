import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonErr(message: string, status = 500) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: Request) {
  try {
    const text = await req.text();
    let body: any = {};
    try { body = JSON.parse(text || "{}"); }
    catch { return jsonErr("Invalid JSON body", 400); }

    const env = [
      `NEXT_PUBLIC_SUPABASE_URL=${String(body.NEXT_PUBLIC_SUPABASE_URL || "").trim()}`,
      `NEXT_PUBLIC_SUPABASE_ANON_KEY=${String(body.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim()}`,
      `SUPABASE_SERVICE_ROLE_KEY=${String(body.SUPABASE_SERVICE_ROLE_KEY || "").trim()}`,
      `DATABASE_URL=${String(body.DATABASE_URL || "").trim()}`,
      // NEW:
      `GIST_RAW_URL=${String(body.GIST_RAW_URL || "").trim()}`,
    ].join("\n") + "\n";

    const file = path.join(process.cwd(), ".env.local");
    try {
      await fs.writeFile(file, env, "utf8");
      return NextResponse.json({ ok: true, file });
    } catch (e: any) {
      // read-only FS (cloud) => fall back to showing copy block
      return NextResponse.json({ ok: false, error: String(e?.message || e) });
    }
  } catch (e: any) {
    return jsonErr(String(e?.message || e), 500);
  }
}
