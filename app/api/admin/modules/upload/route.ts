import { NextResponse } from "next/server";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { IncomingForm } from "formidable";
import unzipper from "unzipper";

// Note: install dependencies: npm i formidable unzipper
export const runtime = "nodejs";

function parseForm(req: Request): Promise<{ files: any; fields: any }> {
  return new Promise((resolve, reject) => {
    const form = new IncomingForm({ multiples: false });
    // @ts-ignore - node Request -> raw
    form.parse(req as any, (err, fields, files) => {
      if (err) return reject(err);
      resolve({ files, fields });
    });
  });
}

export async function POST(req: Request) {
  try {
    const { files } = await parseForm(req);
    const file = files?.file || files?.zip;
    if (!file) return NextResponse.json({ error: "no file uploaded" }, { status: 400 });

    const tmpPath = file.filepath || file.path || file.path;
    // use module name from filename (without extension)
    const baseName = path.basename(file.originalFilename || file.name || tmpPath).replace(/\.[^.]+$/, "");
    const destDir = path.join(process.cwd(), "modules", baseName);

    // ensure dest directory exists
    await fsp.mkdir(destDir, { recursive: true });

    // unzip into destDir
    await new Promise((res, rej) => {
      fs.createReadStream(tmpPath)
        .pipe(unzipper.Extract({ path: destDir }))
        .on("close", res)
        .on("error", rej);
    });

    // read manifest if exists
    const manifestPath = path.join(destDir, "manifest.json");
    let manifest: any = null;
    try {
      const raw = await fsp.readFile(manifestPath, "utf8");
      manifest = JSON.parse(raw);
    } catch {}

    return NextResponse.json({ ok: true, id: baseName, manifest });
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}