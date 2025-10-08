// app/api/modules/register/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jerr(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

export async function POST(req: Request) {
  const SUPA_URL   = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const SUPA_ANON  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!SUPA_URL || !SUPA_ANON || !SERVICE_KEY) {
    return jerr("Supabase is not configured on the server.");
  }

  // 1) Identify the caller (server-verified)
  const jar = await cookies();
  const anon = createServerClient(SUPA_URL, SUPA_ANON, {
    cookies: {
      get: (name: string) => jar.get(name)?.value,
      set() {},
      remove() {},
    },
  });

  const { data: { user }, error: userErr } = await anon.auth.getUser();
  if (userErr || !user?.email) return jerr("Unauthenticated.", 401);

  const email = user.email.toLowerCase();

  // 2) Check admin allowlist with SERVICE client (server-side check)
  const srv = createClient(SUPA_URL, SERVICE_KEY);
  const { data: settings, error: setErr } = await srv
    .from("settings")
    .select("admin_allowlist")
    .eq("id", 1)
    .maybeSingle();

  if (setErr) return jerr(`Failed to read settings: ${setErr.message}`, 500);

  const allow: string[] = Array.isArray(settings?.admin_allowlist)
    ? settings!.admin_allowlist.map((e: string) => (e || "").toLowerCase())
    : [];

  if (!allow.includes(email)) {
    return jerr("Forbidden: not in admin allowlist.", 403);
  }

  // 3) Parse payload
  let payload: any = {};
  try {
    payload = await req.json();
  } catch {
    return jerr("Invalid JSON body.");
  }

  // Minimal validation
  if (!payload?.id || !payload?.kind) {
    return jerr("Missing required fields: id, kind.");
  }
  // Normalize allowed kinds
  const kind = String(payload.kind);
  if (!["page", "block", "floating", "api"].includes(kind)) {
    return jerr("Invalid kind. Use 'page' | 'block' | 'floating' | 'api'.");
  }
  // For page modules, slug must be present
  if (kind === "page" && !payload.slug) {
    return jerr("Page modules require a unique 'slug'.");
  }

  // 4) Upsert with SERVICE client (bypasses RLS after our own admin check)
  const { data, error } = await srv
    .from("modules")
    .upsert(
      {
        id: String(payload.id),
        kind,
        slug: payload.slug ? String(payload.slug) : null,
        title: payload.title ? String(payload.title) : null,
        enabled: !!payload.enabled,
        config: payload.config && typeof payload.config === "object" ? payload.config : {},
      },
      { onConflict: "id" }
    )
    .select("*")
    .single();

  if (error) return jerr(`Upsert failed: ${error.message}`, 400);

  return NextResponse.json({ ok: true, module: data }, { headers: { "Cache-Control": "no-store" } });
}
