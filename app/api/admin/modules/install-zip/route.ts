import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import AdmZip from "adm-zip";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ ok: false, error: "No file provided" }, { status: 400 });
    }

    // Read file buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Extract ZIP using adm-zip
    const zip = new AdmZip(buffer);
    const zipEntries = zip.getEntries();

    // Find manifest.json to get module ID
    const manifestEntry = zipEntries.find(
      (entry) => !entry.isDirectory && entry.entryName.endsWith("manifest.json")
    );

    if (!manifestEntry) {
      return NextResponse.json(
        { ok: false, error: "No manifest.json found in ZIP" },
        { status: 400 }
      );
    }

    // Parse manifest
    const manifestData = manifestEntry.getData().toString("utf8");
    const manifest = JSON.parse(manifestData);
    const moduleId = manifest.id || manifest.slug;

    if (!moduleId) {
      return NextResponse.json(
        { ok: false, error: "Module ID not found in manifest" },
        { status: 400 }
      );
    }

    // Target directory
    const modulesDir = path.join(process.cwd(), "modules");
    const targetDir = path.join(modulesDir, moduleId);

    // Check if module already exists
    try {
      await fs.access(targetDir);
      return NextResponse.json(
        { ok: false, error: `Module ${moduleId} already exists` },
        { status: 409 }
      );
    } catch {
      // Directory doesn't exist, good to proceed
    }

    // Create modules directory if it doesn't exist
    await fs.mkdir(modulesDir, { recursive: true });

    // Extract all files
    for (const entry of zipEntries) {
      const entryPath = entry.entryName;

      // Skip __MACOSX and other hidden files
      if (entryPath.includes("__MACOSX") || entryPath.startsWith(".")) {
        continue;
      }

      // Remove top-level folder name if present
      const parts = entryPath.split("/");
      const relativePath = parts.length > 1 ? parts.slice(1).join("/") : entryPath;

      if (!relativePath) continue;

      const fullPath = path.join(targetDir, relativePath);

      if (entry.isDirectory) {
        await fs.mkdir(fullPath, { recursive: true });
      } else {
        // Ensure parent directory exists
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        // Write file
        const content = entry.getData();
        await fs.writeFile(fullPath, content);
      }
    }

    return NextResponse.json({
      ok: true,
      id: moduleId,
      message: `Module ${moduleId} extracted successfully`,
      manifest,
    });
  } catch (error: any) {
    console.error("Error installing from ZIP:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || String(error) },
      { status: 500 }
    );
  }
}