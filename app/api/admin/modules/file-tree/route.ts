import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const modulesRoot = path.join(process.cwd(), "modules");
const EXCLUDE_DIRS = new Set(["node_modules", ".git", ".next", "dist", "build", "out", "coverage"]);

function toPosix(p: string) {
  return p.replace(/\\/g, "/");
}

async function readDirTree(absDir: string, relDirPosix: string) {
  const dirents = await fs.readdir(absDir, { withFileTypes: true });
  const items: any[] = [];
  for (const d of dirents) {
    if (d.name.startsWith(".")) continue;
    if (d.isDirectory()) {
      if (EXCLUDE_DIRS.has(d.name)) continue;
      const childAbs = path.join(absDir, d.name);
      const childRelPosix = relDirPosix ? `${relDirPosix}/${d.name}` : d.name;
      items.push({
        name: d.name,
        type: "dir",
        path: `/${toPosix(path.posix.join("modules", childRelPosix))}`,
        children: await readDirTree(childAbs, childRelPosix),
      });
    } else if (d.isFile()) {
      // Include editable file types: ts, tsx, js, jsx, json, sql, md, txt, css, scss
      const ext = path.extname(d.name).toLowerCase();
      if ([".ts", ".tsx", ".js", ".jsx", ".json", ".sql", ".md", ".txt", ".css", ".scss"].includes(ext)) {
        items.push({
          name: d.name,
          type: "file",
          path: `/${toPosix(path.posix.join("modules", relDirPosix, d.name))}`,
        });
      }
    }
  }
  // sort: dirs first, then files, alpha
  items.sort((a, b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return items;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const moduleId = (url.searchParams.get("moduleId") || "").trim();
  if (!moduleId) return NextResponse.json({ error: "moduleId is required" }, { status: 400 });

  const absModuleDir = path.join(modulesRoot, moduleId);
  const resolved = path.resolve(absModuleDir);
  const rootResolved = path.resolve(modulesRoot);
  if (!resolved.startsWith(rootResolved + path.sep)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const st = await fs.stat(resolved);
    if (!st.isDirectory()) return NextResponse.json({ error: "not found" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const tree = {
    name: moduleId,
    type: "dir",
    path: `/modules/${moduleId}`,
    children: await readDirTree(resolved, moduleId),
  };

  return NextResponse.json({ moduleId, tree });
}