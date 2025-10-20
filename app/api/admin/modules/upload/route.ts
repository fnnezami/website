export const runtime = "nodejs";

import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file") as any;
    if (!file) return NextResponse.json({ error: "no file" }, { status: 400 });

    // buffer the uploaded zip
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // server-only requires
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require("fs");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = require("path");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const AdmZip = require("adm-zip");

    const tmpDir = path.join(process.cwd(), "tmp", `module-upload-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    // extract zip buffer using adm-zip
    try {
      const zip = new AdmZip(buffer);
      zip.extractAllTo(tmpDir, true);
    } catch (err: any) {
      return NextResponse.json({ error: `failed to extract: ${err.message}` }, { status: 400 });
    }

    // find manifest.json (root or first-level folder)
    function findManifest(dir: string): string | null {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        if (e.isFile() && e.name === "manifest.json") {
          return path.join(dir, e.name);
        }
      }
      for (const e of entries) {
        if (e.isDirectory()) {
          const sub = path.join(dir, e.name, "manifest.json");
          if (fs.existsSync(sub)) return sub;
        }
      }
      return null;
    }

    const manifestPath = findManifest(tmpDir);
    if (!manifestPath) {
      return NextResponse.json({ error: "manifest.json not found in zip" }, { status: 400 });
    }

    const manifestRaw = fs.readFileSync(manifestPath, "utf8");
    let manifest: any;
    try {
      manifest = JSON.parse(manifestRaw);
    } catch (err: any) {
      return NextResponse.json({ error: `invalid manifest: ${err.message}` }, { status: 400 });
    }

    // determine module id and source folder inside tmpDir
    const moduleId = String(manifest.id || manifest.name || path.basename(path.dirname(manifestPath))).replace(
      /\s+/g,
      "-"
    );
    const sourceDir =
      path.dirname(manifestPath) === tmpDir ? tmpDir : path.join(tmpDir, path.basename(path.dirname(manifestPath)));

    const modulesDir = path.join(process.cwd(), "modules");
    fs.mkdirSync(modulesDir, { recursive: true });

    const targetDir = path.join(modulesDir, moduleId);

    // if module already exists, remove it (replace)
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }

    // move/copy extracted files to modules/<moduleId>
    try {
      fs.cpSync(sourceDir, targetDir, { recursive: true });
    } catch {
      fs.renameSync(sourceDir, targetDir);
    }

    // cleanup temp dir
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}

    // Return module id and manifest — admin UI can call /api/admin/modules/install afterwards
    return NextResponse.json({ ok: true, id: moduleId, manifest });
  } catch (err: any) {
    console.error("upload error:", err);
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}