import fs from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

const modulesRoot = path.join(process.cwd(), "modules");

function getMimeType(filePath: string) {
    if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
    if (filePath.endsWith(".js")) return "application/javascript; charset=utf-8";
    if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
    if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
    if (filePath.endsWith(".svg")) return "image/svg+xml";
    if (filePath.endsWith(".png")) return "image/png";
    if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) return "image/jpeg";
    return "application/octet-stream";
}

export async function GET(_: Request, context: any) {
    // Next.js requires awaiting the context before using params
    const { params } = await context;
    const segments = params?.path || [];
    if (segments.length < 2) {
        return new NextResponse(null, { status: 404 });
    }

    const moduleId = segments[0];
    const rest = segments.slice(1);

    // Only allow:
    //  - /modules/<moduleId>/manifest.json
    //  - /modules/<moduleId>/public/...
    const allowedManifest = rest.length === 1 && rest[0] === "manifest.json";
    const allowedPublic = rest[0] === "public";

    if (!allowedManifest && !allowedPublic) {
        return new NextResponse(null, { status: 404 });
    }

    const filePath = path.join(modulesRoot, moduleId, ...rest);
    // Security: ensure resolved path is inside modulesRoot
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(path.resolve(modulesRoot) + path.sep)) {
        return new NextResponse(null, { status: 403 });
    }

    try {
        const stat = await fs.stat(resolved);
        if (!stat.isFile()) return new NextResponse(null, { status: 404 });
        const data = await fs.readFile(resolved);
        const mime = getMimeType(resolved);
        return new NextResponse(data, {
            status: 200,
            headers: {
                "content-type": mime,
            },
        });
    } catch (err) {
        return new NextResponse(null, { status: 404 });
    }
}