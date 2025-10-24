export const runtime = "nodejs";

import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const FILES = [path.join(ROOT, "app", "globals.css"), path.join(ROOT, "app", "theme-overrides.css")];

export async function GET() {
  let out = "";
  for (const f of FILES) {
    try {
      out += `/* ${path.basename(f)} */\n` + (await fs.readFile(f, "utf8")) + "\n\n";
    } catch {}
  }
  return new NextResponse(out, { headers: { "Content-Type": "text/css; charset=utf-8" } });
}