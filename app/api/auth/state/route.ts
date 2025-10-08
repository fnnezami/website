// app/api/auth/state/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const SUPA_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const SUPA_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  // If Supabase isn't configured yet, report unauthenticated.
  if (!SUPA_URL || !SUPA_ANON) {
    return NextResponse.json(
      { authed: false, email: null },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  // Next 15+: cookies() is async, and we only need a getter for SSR auth
  const jar = await cookies();
  const supa = createServerClient(SUPA_URL, SUPA_ANON, {
    cookies: {
      get: (name: string) => jar.get(name)?.value,
      set() {},
      remove() {},
    },
  });

  // ✅ Server-authenticated user (contacts Supabase Auth)
  const { data: { user }, error } = await supa.auth.getUser();

  // Don’t expose internal errors; just return the state
  return NextResponse.json(
    { authed: !!user, email: user?.email ?? null },
    { headers: { "Cache-Control": "no-store" } }
  );
}
