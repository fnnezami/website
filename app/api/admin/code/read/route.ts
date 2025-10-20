import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { file } = body || {};
    if (!file || typeof file !== "string") {
      return NextResponse.json({ ok: false, error: "file required" }, { status: 400 });
    }

    // Security: only allow files with specific extensions
    const ext = path.extname(file).toLowerCase();
    const allowed = [".ts", ".tsx", ".js", ".jsx", ".json", ".sql", ".md", ".txt", ".css", ".scss"];
    if (!allowed.includes(ext)) {
      return NextResponse.json(
        { ok: false, error: `File type not allowed. Allowed: ${allowed.join(", ")}` },
        { status: 400 }
      );
    }

    // Security: resolve absolute path and ensure it's within project
    const absPath = path.resolve(process.cwd(), file.startsWith("/") ? file.slice(1) : file);
    const projectRoot = path.resolve(process.cwd());
    if (!absPath.startsWith(projectRoot + path.sep)) {
      return NextResponse.json({ ok: false, error: "forbidden path" }, { status: 403 });
    }

    // Read file
    const code = await fs.readFile(absPath, "utf-8");

    return NextResponse.json({ ok: true, code });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
