import { NextResponse } from "next/server";
import { Client } from "pg";

export const runtime = "nodejs";

async function getPgClient() {
  const conn = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (!conn) throw new Error("Missing SUPABASE_DB_URL / DATABASE_URL env");
  const client = new Client({ connectionString: conn });
  await client.connect();
  return client;
}

export async function GET(req: Request) {
  try {
    // optional moduleId query
    const url = new URL(req.url);
    const moduleId = url.searchParams.get("moduleId");

    const client = await getPgClient();
    try {
      // ensure table exists (benign if not)
      await client.query(`
        CREATE TABLE IF NOT EXISTS modules_migrations (
          id SERIAL PRIMARY KEY,
          module_id TEXT NOT NULL,
          migration TEXT NOT NULL,
          success BOOLEAN,
          applied_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
          error TEXT
        );
      `);

      const q = moduleId
        ? `SELECT id, module_id, migration, success, applied_at, error FROM modules_migrations WHERE module_id = $1 ORDER BY applied_at DESC`
        : `SELECT id, module_id, migration, success, applied_at, error FROM modules_migrations ORDER BY applied_at DESC LIMIT 200`;

      const res = moduleId ? await client.query(q, [moduleId]) : await client.query(q);
      await client.end();
      return NextResponse.json({ ok: true, logs: res.rows });
    } catch (e: any) {
      await client.end();
      return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}