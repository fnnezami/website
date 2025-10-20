import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const SUPA_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const SUPA_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const res = NextResponse.redirect(new URL("/login", base));

  if (!SUPA_URL || !SUPA_ANON) {
    // best-effort clear if envs missing
    res.cookies.set({ name: "sb-access-token", value: "", path: "/", maxAge: 0 });
    res.cookies.set({ name: "sb-refresh-token", value: "", path: "/", maxAge: 0 });
    return res;
  }

  const cookieStore = await cookies();
  const supa = createServerClient(SUPA_URL, SUPA_ANON, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) =>
          res.cookies.set(name, value, options)
        );
      },
    },
  });

  await supa.auth.signOut();
  return res;
}
