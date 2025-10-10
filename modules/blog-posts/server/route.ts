// This file is internal to the module and exposes HTTP-style handlers.
// It maps a small REST surface to the module's server/api.ts helpers.

import * as api from "./api";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

type AnyCtx = Record<string, any>;

// tiny cookie parser (module-local)
function parseCookies(cookieHeader: string | null) {
  const map: Record<string, string> = {};
  if (!cookieHeader) return map;
  for (const part of cookieHeader.split(";")) {
    const [k, ...rest] = part.split("=");
    if (!k) continue;
    map[k.trim()] = decodeURIComponent((rest || []).join("=").trim() || "");
  }
  return map;
}

// helper: normalize segments from different handler ctx shapes
function getSegmentsFromCtx(ctx: AnyCtx) {
  // Next.js App Router route handlers can receive { params: { segments: string[] } }
  // older patterns or custom callers might pass { segments: [...] } directly.
  const params = ctx?.params || ctx;
  const segs = params?.segments ?? params?.slug ?? [];
  if (typeof segs === "string") return [segs];
  return Array.isArray(segs) ? segs : [];
}

// module-local admin verification (self-contained)
async function verifyAdmin(req: Request) {
  const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const SUPA_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!SUPA_URL || !SUPA_ANON || !SERVICE) throw new Error("Supabase envs not configured for admin checks");

  const cookieHeader = req.headers.get("cookie") || "";
  const cookies = parseCookies(cookieHeader);

  const server = createServerClient(SUPA_URL, SUPA_ANON, {
    cookies: {
      get: (n: string) => cookies[n],
      set: () => {},
      remove: () => {},
    },
  });

  const { data: authData, error: authError } = await server.auth.getUser();
  if (authError) throw authError;
  const user = authData?.user;
  const email = user?.email?.toLowerCase() || null;
  if (!email) throw new Error("Not authenticated");

  const svc = createClient(SUPA_URL, SERVICE);
  const { data: settings, error: settingsError } = await svc
    .from("settings")
    .select("admin_allowlist")
    .eq("id", 1)
    .maybeSingle();

  if (settingsError) throw settingsError;

  const allow: string[] = Array.isArray(settings?.admin_allowlist)
    ? settings!.admin_allowlist.map((e: string) => (e || "").toLowerCase())
    : [];

  // if allowlist is empty, default to allow any authenticated user
  if (allow.length === 0) return true;
  return allow.includes(email);
}

async function handleError(err: any) {
  return NextResponse.json(
    { ok: false, error: String(err?.message || err), stack: err?.stack || null },
    { status: 500 }
  );
}

export async function GET(req: Request, ctx: AnyCtx) {
  const s = getSegmentsFromCtx(ctx);
  try {
    if (s[0] === "admin") {
      await verifyAdmin(req);
      const posts = await api.adminListPosts();
      return NextResponse.json({ ok: true, posts });
    }

    if (s.length === 0 || (s.length === 1 && s[0] === "")) {
      const posts = await api.listPublishedPosts();
      return NextResponse.json({ ok: true, posts });
    }

    const slug = String(s[0]);
    const post = await api.getPostBySlug(slug);
    if (!post) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
    return NextResponse.json({ ok: true, post });
  } catch (err: any) {
    return handleError(err);
  }
}

export async function POST(req: Request, ctx: AnyCtx) {
  const s = getSegmentsFromCtx(ctx);
  try {
    if (s[0] === "admin") {
      await verifyAdmin(req);
      const body = await req.json();
      const created = await api.adminCreatePost(body);
      return NextResponse.json({ ok: true, created });
    }
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  } catch (err: any) {
    return handleError(err);
  }
}

export async function PUT(req: Request, ctx: AnyCtx) {
  const s = getSegmentsFromCtx(ctx);
  try {
    if (s[0] === "admin" && s[1]) {
      await verifyAdmin(req);
      const id = Number(s[1]);
      const body = await req.json();
      await api.adminUpdatePost(id, body);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  } catch (err: any) {
    return handleError(err);
  }
}

export async function DELETE(req: Request, ctx: AnyCtx) {
  const s = getSegmentsFromCtx(ctx);
  try {
    if (s[0] === "admin" && s[1]) {
      await verifyAdmin(req);
      const id = Number(s[1]);
      await api.adminDeletePost(id);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  } catch (err: any) {
    return handleError(err);
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;