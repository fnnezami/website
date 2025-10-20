// app/auth/signin/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);

  const host = req.headers.get("x-forwarded-host");
  const proto = req.headers.get("x-forwarded-proto");
  const vercelUrl = req.headers.get("x-vercel-deployment-url");
  const referer = req.headers.get("referer");
  console.error("[signin] url:", url.toString());
  console.error("[signin] x-forwarded-host:", host);
  console.error("[signin] x-forwarded-proto:", proto);
  console.error("[signin] x-vercel-deployment-url:", vercelUrl);
  console.error("[signin] referer:", referer);

  const next = url.searchParams.get("next") || "/admin";
  const baseOrigin =
    (proto ? `${proto}://` : url.protocol) +
    (host || url.host);
  console.error("[signin] baseOrigin:", baseOrigin);

  const SUPA_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const SUPA_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!SUPA_URL || !SUPA_ANON) {
    return NextResponse.redirect(new URL("/setup/install", baseOrigin));
  }
// Compute external origin (works with hosts alias/proxies)

  // IMPORTANT: create a response object we will RETURN (so cookies stick)
  const res = NextResponse.redirect(new URL("/", baseOrigin)); // temp; we'll overwrite Location below

  const jar = await cookies();
  const supa = createServerClient(SUPA_URL, SUPA_ANON, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) =>
          res.cookies.set(name, value, options)
        );
      },
    },
  });

  

  const redirectTo = `${baseOrigin}/auth/callback?next=${encodeURIComponent(next)}`;
  console.error("[signin] redirectTo:", redirectTo);

  const { data, error } = await supa.auth.signInWithOAuth({
    provider: "github",
    options: { redirectTo },
  });
  console.error("[signin] provider url:", data?.url, "error:", error?.message);

  if (error || !data?.url) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error?.message || "OAuth init failed")}`, url.origin)
    );
  }

  // CRITICAL: reuse the SAME response object that got the cookies set
  res.headers.set("Location", data.url);
  return res;
}
