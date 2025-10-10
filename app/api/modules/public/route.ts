import { NextResponse } from "next/server";

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
    const moduleId = url.searchParams.get("module");
    let file = url.searchParams.get("file") || "widget.js";
    if (!moduleId) return NextResponse.json({ error: "missing module" }, { status: 400 });

    // sanitize file path: disallow ../ and absolute paths
    file = file.replace(/\\/g, "/");
    if (file.includes("..")) return NextResponse.json({ error: "invalid file path" }, { status: 400 });

    // resolve path under modules/<id>/public
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = require("path");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require("fs");

    const modulesDir = path.join(process.cwd(), "modules");
    const publicPath = path.join(modulesDir, moduleId, "public", file);
    const rel = path.relative(path.join(modulesDir, moduleId, "public"), publicPath);
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
      return NextResponse.json({ error: "invalid file path" }, { status: 400 });
    }
    if (!fs.existsSync(publicPath) || !fs.statSync(publicPath).isFile()) {
      return NextResponse.json({ error: "file not found" }, { status: 404 });
    }

    const ext = path.extname(publicPath).toLowerCase();
    const body = fs.readFileSync(publicPath);

    const headers: Record<string, string> = {};
    headers["Content-Type"] = MIME[ext] || "application/octet-stream";
    // disable caching during dev; you may adjust caching headers in prod
    headers["Cache-Control"] = "no-store";

    return new NextResponse(body, { status: 200, headers });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}