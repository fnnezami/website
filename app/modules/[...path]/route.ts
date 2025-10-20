import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  context: { params: Promise<{ path: string[] }> }
) {
  try {
    // Await params directly, not the context
    const params = await context.params;
    const segments = params.path || [];

    if (segments.length < 2) {
      return new NextResponse(null, { status: 404 });
    }

    const moduleId = segments[0];
    const filePath = segments.slice(1).join("/");

    const fullPath = path.join(process.cwd(), "modules", moduleId, filePath);
    const content = await readFile(fullPath, "utf-8");

    const ext = path.extname(filePath);
    let contentType = "text/plain; charset=utf-8";

    if (ext === ".js") contentType = "application/javascript; charset=utf-8";
    else if (ext === ".json") contentType = "application/json; charset=utf-8";
    else if (ext === ".css") contentType = "text/css; charset=utf-8";

    return new NextResponse(content, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-cache",
      },
    });
  } catch (err: any) {
    return new NextResponse(`Not found: ${err.message}`, { status: 404 });
  }
}