import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file") as any;
    if (!file) return NextResponse.json({ ok: false, error: "no file uploaded" }, { status: 400 });

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

    // extract zip buffer
    try {
      const zip = new AdmZip(buffer);
      zip.extractAllTo(tmpDir, true);
    } catch (err: any) {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
      return NextResponse.json({ ok: false, error: "failed to extract zip: " + String(err?.message || err) }, { status: 400 });
    }

    // find manifest.json (root or first-level folder)
    function findManifest(dir: string) {
      const rootManifest = path.join(dir, "manifest.json");
      if (fs.existsSync(rootManifest)) return rootManifest;
      const items = fs.readdirSync(dir);
      for (const it of items) {
        const p = path.join(dir, it, "manifest.json");
        if (fs.existsSync(p)) return p;
      }
      return null;
    }

    const manifestPath = findManifest(tmpDir);
    if (!manifestPath) {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
      return NextResponse.json({ ok: false, error: "manifest.json not found in archive" }, { status: 400 });
    }

    const manifestRaw = fs.readFileSync(manifestPath, "utf8");
    let manifest: any;
    try {
      manifest = JSON.parse(manifestRaw);
    } catch (err: any) {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
      return NextResponse.json({ ok: false, error: "invalid manifest.json" }, { status: 400 });
    }

    // determine module id and source folder inside tmpDir
    const moduleId = String(manifest.id || manifest.name || path.basename(path.dirname(manifestPath))).replace(/\s+/g, "-");
    const sourceDir = path.dirname(manifestPath) === tmpDir ? tmpDir : path.join(tmpDir, path.basename(path.dirname(manifestPath)));

    const modulesDir = path.join(process.cwd(), "modules");
    fs.mkdirSync(modulesDir, { recursive: true });

    const targetDir = path.join(modulesDir, moduleId);

    // if module already exists, remove it (replace)
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }

    // move/copy extracted files to modules/<moduleId>
    try {
      fs.renameSync(sourceDir, targetDir);
    } catch {
      // fallback: recursive copy
      const copyRecursive = (src: string, dest: string) => {
        const stats = fs.statSync(src);
        if (stats.isDirectory()) {
          fs.mkdirSync(dest, { recursive: true });
          for (const item of fs.readdirSync(src)) {
            copyRecursive(path.join(src, item), path.join(dest, item));
          }
        } else {
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.copyFileSync(src, dest);
        }
      };
      copyRecursive(sourceDir, targetDir);
    }

    // cleanup temp dir
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}

    // Return module id and manifest — admin UI can call /api/admin/modules/install afterwards
    return NextResponse.json({ ok: true, id: moduleId, manifest });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}