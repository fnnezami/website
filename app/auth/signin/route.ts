// app/auth/signin/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") ?? url.host;
  const proto = req.headers.get("x-forwarded-proto") ?? (url.protocol.replace(":", "") || "http");
  const baseOrigin = `${proto}://${host}`;
  const next = url.searchParams.get("next") || "/admin";

  const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const SUPA_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!SUPA_URL || !SUPA_ANON) return NextResponse.redirect(new URL("/setup/install", baseOrigin));

  const res = new NextResponse(null, { status: 302 }); // no preset Location

  const jar = await cookies();
  const supa = createServerClient(SUPA_URL, SUPA_ANON, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (cookiesToSet) => cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options)),
    },
  });

  const redirectTo = `${baseOrigin}/auth/callback?next=${encodeURIComponent(next)}`;
  const { data, error } = await supa.auth.signInWithOAuth({ provider: "github", options: { redirectTo } });
  if (error || !data?.url) return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error?.message || "OAuth init failed")}`, baseOrigin));

  res.headers.set("Location", data.url); // only redirect target
  return res;
}
