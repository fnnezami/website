import { NextResponse } from "next/server";
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";

function parseCookies(cookieHeader: string | null) {
  const map: Record<string, string> = {};
  if (!cookieHeader) return map;
  for (const part of cookieHeader.split(";")) {
    const [k, ...rest] = part.split("=");
    if (!k) continue;
    map[k.trim()] = decodeURIComponent((rest || []).join("=").trim());
  }
  return map;
}

async function verifyAdmin(req: Request) {
  const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const SUPA_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!SUPA_URL || !SUPA_ANON || !SERVICE) throw new Error("Supabase envs not configured");

  const cookieHeader = req.headers.get("cookie") || "";
  const cookies = parseCookies(cookieHeader);
  const server = createServerClient(SUPA_URL, SUPA_ANON, {
    cookies: {
      get: (n: string) => cookies[n],
      set: () => {},
      remove: () => {},
    },
  });

  const { data: { user } } = await server.auth.getUser();
  const email = user?.email?.toLowerCase() || null;
  if (!email) throw new Error("Not authenticated");

  const srv = createClient(SUPA_URL, SERVICE);
  const { data: settings, error } = await srv
    .from("settings")
    .select("admin_allowlist")
    .eq("id", 1)
    .maybeSingle();

  if (error) throw error;
  const allow: string[] = Array.isArray(settings?.admin_allowlist)
    ? settings!.admin_allowlist.map((e: string) => (e || "").toLowerCase())
    : [];

  if (allow.length === 0) return true;
  return allow.includes(email);
}

async function getPgClient() {
  const DB_URL_RAW = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (!DB_URL_RAW) throw new Error("Missing SUPABASE_DB_URL / DATABASE_URL env");
  const client = new Client({
    connectionString: DB_URL_RAW,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  return client;
}

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
    await verifyAdmin(req);

    const pg = await getPgClient();
    try {
      // Re-apply the modules foundation pieces (idempotent)
      await exec(pg, `
        create or replace function public.is_admin()
        returns boolean
        language plpgsql
        stable
        as $$
        declare
          allowlist text[];
          me text;
        begin
          select admin_allowlist into allowlist from public.settings where id = 1;
          select lower(auth.jwt() ->> 'email') into me;
          if me is null then
            return false;
          end if;
          return array_position(allowlist, me) is not null;
        end;
        $$;
      `, [], "create is_admin()");

      await exec(pg, `
        create table if not exists public.modules (
          id          text primary key,
          kind        text not null check (kind in ('page','block','floating','api')),
          slug        text unique,
          title       text,
          enabled     boolean not null default false,
          config      jsonb not null default '{}'::jsonb,
          created_at  timestamptz not null default now(),
          updated_at  timestamptz not null default now()
        );
      `, [], "create modules");

      await exec(pg, `create index if not exists modules_kind_enabled_idx on public.modules(kind, enabled);`, [], "idx kind+enabled");
      await exec(pg, `create index if not exists modules_slug_idx on public.modules(slug);`, [], "idx slug");

      await exec(pg, `alter table public.modules enable row level security;`, [], "rls modules");

      await exec(pg, `drop policy if exists "modules read enabled" on public.modules;`, [], "drop modules read policy");
      await exec(pg, `
        create policy "modules read enabled"
        on public.modules
        for select
        to anon, authenticated
        using (enabled = true);
      `, [], "create modules read policy");

      await exec(pg, `drop policy if exists "modules write admins" on public.modules;`, [], "drop modules write policy");
      await exec(pg, `
        create policy "modules write admins"
        on public.modules
        for all
        to authenticated
        using (public.is_admin() = true)
        with check (public.is_admin() = true);
      `, [], "create modules write policy");

      await exec(pg, `
        create or replace function public.touch_updated_at()
        returns trigger
        language plpgsql
        as $$
        begin
          new.updated_at = now();
          return new;
        end;
        $$;
      `, [], "create touch_updated_at()");

      await exec(pg, `drop trigger if exists trg_modules_updated on public.modules;`, [], "drop trg");
      await exec(pg, `
        create trigger trg_modules_updated
        before update on public.modules
        for each row execute procedure public.touch_updated_at();
      `, [], "create trg");

      await exec(pg, `
        create table if not exists public.modules_migrations (
          id serial primary key,
          module_id text not null,
          migration text not null,
          success boolean,
          applied_at timestamptz default now(),
          error text
        );
      `, [], "create modules_migrations");

      return NextResponse.json({ ok: true, message: "reprovision applied" });
    } finally {
      await pg.end();
    }
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}