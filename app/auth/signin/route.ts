// app/auth/signin/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const next = url.searchParams.get("next") || "/admin";

  const SUPA_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const SUPA_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!SUPA_URL || !SUPA_ANON) {
    return NextResponse.redirect(new URL("/setup/install", url.origin));
  }

  // IMPORTANT: create a response object we will RETURN (so cookies stick)
  const res = NextResponse.redirect(new URL("/", url.origin)); // temp; we'll overwrite Location below

  const jar = await cookies();
  const supa = createServerClient(SUPA_URL, SUPA_ANON, {
    cookies: {
      get: (name) => jar.get(name)?.value,
      set: (name, value, options) => res.cookies.set({ name, value, ...options }),
      remove: (name, options) => res.cookies.set({ name, value: "", ...options }),
    },
  });

  const redirectTo = `${url.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  // This sets the PKCE code_verifier cookie via our 'res' cookie setters
  const { data, error } = await supa.auth.signInWithOAuth({
    provider: "github",
    options: { redirectTo },
  });

  if (error || !data?.url) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error?.message || "OAuth init failed")}`, url.origin)
    );
  }

  // CRITICAL: reuse the SAME response object that got the cookies set
  res.headers.set("Location", data.url);
  return res;
}
