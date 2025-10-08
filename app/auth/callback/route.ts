// app/auth/callback/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { Client } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/admin";

  const SUPA_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const SUPA_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const DB_URL_RAW = process.env.DATABASE_URL || ""; // needed to write allowlist

  if (!SUPA_URL || !SUPA_ANON) {
    return NextResponse.redirect(new URL("/setup/install", url.origin));
  }

  // We’ll redirect here when done
  const res = NextResponse.redirect(new URL(next, url.origin));

  // Bind Supabase to request cookies and write session cookies to the response
  const jar = await cookies();
  const supa = createServerClient(SUPA_URL, SUPA_ANON, {
    cookies: {
      get: (name) => jar.get(name)?.value,
      set: (name, value, options) => res.cookies.set({ name, value, ...options }),
      remove: (name, options) => res.cookies.set({ name, value: "", ...options }),
    },
  });

  // 1) Finish OAuth — set session cookies
  if (code) {
    const { error } = await supa.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin)
      );
    }
  }

  // 2) Read current user from the *now-set* session cookies
  const { data: { user } } = await supa.auth.getUser();
  const email = user?.email?.toLowerCase();

  // 3) Atomic, one-time bootstrap of the admin allowlist (only if empty)
  //    This uses direct Postgres so we can use WHERE cardinality(array)=0
  if (email && DB_URL_RAW) {
    const DB_URL = /sslmode=/i.test(DB_URL_RAW)
      ? DB_URL_RAW
      : `${DB_URL_RAW}${DB_URL_RAW.includes("?") ? "&" : "?"}sslmode=require`;

    const pg = new Client({
      connectionString: DB_URL,
      ssl: { rejectUnauthorized: false },
    });

    try {
      await pg.connect();
      await pg.query(
        `UPDATE public.settings
           SET admin_allowlist = ARRAY[$1]::text[], updated_at = now()
         WHERE id = 1 AND cardinality(admin_allowlist) = 0`,
        [email]
      );
      // If another request won the race, rowCount will be 0 — that’s fine.
    } catch {
      // Swallow bootstrap errors—admin page will still show “Access denied” if needed.
    } finally {
      await pg.end();
    }
  }

  // 4) Done — send them to /admin (or ?next=)
  return res;
}
