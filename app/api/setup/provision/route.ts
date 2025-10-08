// app/api/setup/provision/route.ts
import { NextResponse } from "next/server";
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jerr(message: string, status = 500) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

// Run one statement at a time so errors are easy to pinpoint
async function exec(pg: Client, sql: string, params: any[] = [], label?: string) {
  try {
    await pg.query(sql, params);
  } catch (e: any) {
    const where = label ? ` [${label}]` : "";
    throw new Error(`SQL error${where}: ${e?.message || e}`);
  }
}

export async function POST(req: Request) {
  try {
    // Dev-only TLS bypass to avoid local self-signed issues
    if (process.env.NODE_ENV !== "production") {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    }

    // Parse body safely
    const bodyText = await req.text();
    let body: any = {};
    try { body = JSON.parse(bodyText || "{}"); }
    catch { return jerr("Invalid JSON body", 400); }

    const SUPABASE_URL = String(body.NEXT_PUBLIC_SUPABASE_URL || "").trim();
    const ANON_KEY     = String(body.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
    const SERVICE_KEY  = String(body.SUPABASE_SERVICE_ROLE_KEY || "").trim();
    const DB_URL_RAW   = String(body.DATABASE_URL || "").trim();
    const ALLOW_INPUT  = Array.isArray(body.ADMIN_ALLOWLIST) ? body.ADMIN_ALLOWLIST : [];

    if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY || !DB_URL_RAW) {
      return jerr("All fields are required: Supabase URL, anon key, service role key, database URL.", 400);
    }

    // Normalize allowlist emails
    const allowlist: string[] = ALLOW_INPUT
      .map((e: any) => String(e || "").trim().toLowerCase())
      .filter(Boolean);

    // Ensure sslmode=require for Supabase PG
    const DB_URL = /sslmode=/i.test(DB_URL_RAW)
      ? DB_URL_RAW
      : `${DB_URL_RAW}${DB_URL_RAW.includes("?") ? "&" : "?"}sslmode=require`;

    // 1) DB: connect and create tables/policies step-by-step
    const pg = new Client({
      connectionString: DB_URL,
      ssl: { rejectUnauthorized: false },
    });
    await pg.connect();

    try {
      // SETTINGS TABLE
      await exec(pg, `
        create table if not exists public.settings (
          id               int primary key default 1,
          setup_completed  boolean not null default false,
          encrypted        jsonb   not null default '{}'::jsonb,
          admin_allowlist  text[]  not null default '{}'::text[],
          updated_at       timestamptz default now()
        );
      `, [], "create settings");

      // Enable RLS (no policies => client can't read/write; server (service key) can)
      await exec(pg, `alter table public.settings enable row level security;`, [], "rls settings");

      // Seed row if missing
      await exec(pg, `
        insert into public.settings (id, setup_completed, encrypted, admin_allowlist)
        values (1, false, '{}'::jsonb, '{}'::text[])
        on conflict (id) do nothing;
      `, [], "seed settings");

      // Update allowlist via parameterized query
      await exec(pg, `update public.settings set admin_allowlist = $1::text[] where id = 1;`, [allowlist], "set allowlist");

      // PROJECT_DETAILS TABLE
      await exec(pg, `
        create table if not exists public.project_details (
          slug         text primary key,
          content_md   text,
          cover_image  text,
          gallery      text[] default '{}'::text[],
          updated_at   timestamptz default now()
        );
      `, [], "create project_details");

      // Enable RLS on project_details
      await exec(pg, `alter table public.project_details enable row level security;`, [], "rls project_details");

      // Drop & recreate only a read policy (public read)
      await exec(pg, `drop policy if exists "project_details read" on public.project_details;`, [], "drop pd read policy");
      await exec(pg, `
        create policy "project_details read"
        on public.project_details for select
        to anon, authenticated
        using (true);
      `, [], "create pd read policy");

      // No insert/update/delete policies => denied by default for clients (good)
    } finally {
      await pg.end();
    }

    // 2) Storage: ensure public bucket 'projects'
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: buckets, error: listErr } = await admin.storage.listBuckets();
    if (listErr) return jerr(`listBuckets: ${listErr.message}`);

    const exists = buckets?.some(b => b.name === "projects");
    if (!exists) {
      const { error: createErr } = await admin.storage.createBucket("projects", { public: true });
      if (createErr) return jerr(`createBucket: ${createErr.message}`);
    } else {
      await admin.storage.updateBucket("projects", { public: true }).catch(() => {});
    }

    // 3) Mark setup complete
    const { error: upErr } = await admin.from("settings").upsert({ id: 1, setup_completed: true });
    if (upErr) return jerr(`settings upsert: ${upErr.message}`);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return jerr(String(e?.message || e), 500);
  }
}
