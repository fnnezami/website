// Lists (.sql) and runs a selected migration for a given moduleId
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { readdir, readFile } from "fs/promises";
import path from "node:path";
import { Pool } from "pg";

const pool: any = (globalThis as any).__admin_pg__ || new Pool({ connectionString: process.env.DATABASE_URL });
(globalThis as any).__admin_pg__ = pool;

function resolveModuleMigrations(moduleId: string) {
  // modules/<id>/migrations (project root is the "website" dir)
  const safeId = String(moduleId || "").trim();
  if (!/^[a-zA-Z0-9_-]+$/.test(safeId)) throw new Error("Invalid moduleId");

  const base = path.resolve(process.cwd(), "modules"); // FIX: was "website/modules"
  const dir = path.resolve(base, safeId, "migrations");
  if (!dir.startsWith(base)) throw new Error("Invalid moduleId");
  return dir;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const moduleId = url.searchParams.get("moduleId") || "";
    if (!moduleId) return NextResponse.json({ ok: false, error: "Missing moduleId" }, { status: 400 });

    const dir = resolveModuleMigrations(moduleId);
    const files = await readdir(dir).catch(() => []);
    const list = files.filter(f => f.toLowerCase().endsWith(".sql")).sort((a, b) => a.localeCompare(b));
    return NextResponse.json({ ok: true, files: list, dir });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const moduleId = String(body?.moduleId || "");
    const file = String(body?.file || "");
    if (!moduleId || !file) return NextResponse.json({ ok: false, error: "Missing moduleId or file" }, { status: 400 });

    const dir = resolveModuleMigrations(moduleId);
    const full = path.resolve(dir, file);
    if (!full.startsWith(dir)) return NextResponse.json({ ok: false, error: "Invalid file path" }, { status: 400 });

    const sql = await readFile(full, "utf8");

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("COMMIT");
    } catch (e: any) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 });
  }
}