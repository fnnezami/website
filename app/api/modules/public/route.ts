import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";

export const runtime = "nodejs";

const MIME: Record<string, string> = {
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const { searchParams } = url;

    const moduleId = searchParams.get("module") || "";
    const file = searchParams.get("file") || "";

    if (!moduleId) return NextResponse.json({ error: "missing module" }, { status: 400 });

    // sanitize file path: disallow ../ and absolute paths
    const safeFile = file.replace(/\\/g, "/");
    if (safeFile.includes("..")) return NextResponse.json({ error: "invalid file path" }, { status: 400 });

    const modulesRoot = path.join(process.cwd(), "modules");

    // previous: filePath = path.join(modulesRoot, moduleId, "public", file);
    let filePath: string;
    if (file === "manifest.json") {
      // manifest lives at module root (self-contained modules)
      filePath = path.join(modulesRoot, moduleId, "manifest.json");
    } else {
      filePath = path.join(modulesRoot, moduleId, "public", file);
    }

    const rel = path.relative(path.join(modulesRoot, moduleId, "public"), filePath);
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
      return NextResponse.json({ error: "invalid file path" }, { status: 400 });
    }
    if (!fs.existsSync(filePath)) {
      return new Response(null, { status: 404 });
    }

    const ext = path.extname(filePath).toLowerCase();
    const body = fs.readFileSync(filePath);

    const headers: Record<string, string> = {};
    headers["Content-Type"] = MIME[ext] || "application/octet-stream";
    // disable caching during dev; you may adjust caching headers in prod
    headers["Cache-Control"] = "no-store";

    return new NextResponse(body, { status: 200, headers });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}