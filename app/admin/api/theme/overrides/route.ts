export const runtime = "nodejs";

import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const FILE = path.join(ROOT, "app", "theme-overrides.css");

// No auth here — layout is the only gate
export async function GET() {
  try {
    const css = await fs.readFile(FILE, "utf8");
    return new NextResponse(css, { headers: { "Content-Type": "text/css; charset=utf-8" } });
  } catch {
    return new NextResponse("", { headers: { "Content-Type": "text/css; charset=utf-8" } });
  }
}

export async function POST(req: Request) {
  const css = await req.text();
  await fs.writeFile(FILE, css, "utf8");
  return NextResponse.json({ ok: true, bytes: Buffer.byteLength(css, "utf8") });
}