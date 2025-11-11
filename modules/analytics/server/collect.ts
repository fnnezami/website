import { NextResponse } from "next/server";
import { supabaseAdmin } from "./_supabase";
import { enrichIp, hashIp } from "./enrichment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getClientIp(req: Request) {
  const h = req.headers;
  const xff = h.get("x-forwarded-for"); // may contain multiple, take first
  if (xff) return xff.split(",")[0].trim();
  const cf = h.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const xr = h.get("x-real-ip");
  if (xr) return xr.trim();
  const xc = h.get("x-client-ip");
  if (xc) return xc.trim();
  return "";
}

function isAdminRequest(req: Request, path: string) {
  if (path.startsWith("/admin")) return true;
  const roleHeader = req.headers.get("x-user-role");
  if (roleHeader && roleHeader.toLowerCase() === "admin") return true;
  const cookie = req.headers.get("cookie") || "";
  if (/role=admin/i.test(cookie)) return true;
  if (/admin_session=1/.test(cookie)) return true;
  return false;
}

export async function POST(req: Request) {
  try {
    const supabase = supabaseAdmin();
    const body = await req.json().catch(() => ({}));
    const path = String(body.path || "/");
    if (isAdminRequest(req, path)) {
      return NextResponse.json({ ok: true, skipped: "admin" });
    }

    // ALWAYS prefer explicit IP if provided; otherwise use headers
    const ip = body?.ip ? String(body.ip) : getClientIp(req);

    const salt = process.env.ANALYTICS_SALT || "";
    const ipHash = hashIp(ip, salt);
    const geo = ip ? await enrichIp(ip) : null;

    const ua = req.headers.get("user-agent") || "";
    const ref = body.referrer || req.headers.get("referer") || "";
    const refHost = (() => { try { return ref ? new URL(ref).host : null; } catch { return null; } })();

    const row = {
      ts: new Date().toISOString(),
      path,
      title: body.title ? String(body.title).slice(0, 300) : null,
      entity_type: body.entityType ? String(body.entityType) : null,
      entity_id: body.entityId ? String(body.entityId) : null,
      referrer: ref || null,
      referrer_host: refHost,
      user_agent: ua.slice(0, 500),
      client_id: body.clientId ? String(body.clientId).slice(0, 120) : null,
      ip_hash: ipHash,
      ip_country: geo?.country || null,
      ip_region: geo?.region || null,
      ip_city: geo?.city || null,
      ip_lat: geo?.lat ?? null,
      ip_lon: geo?.lon ?? null,
      ip_org: geo?.org || null,
      ip_asn: geo?.asn || null,
      ip_company: geo?.company || null,
    };

    const { error } = await supabase.from("analytics_events").insert(row);
    if (error) {
      const hint = (error as any)?.code === "42P01" ? "Table analytics_events missing. Run migrations." : "Insert failed.";
      throw new Error(`${error.message || "insert failed"} (${hint})`);
    }
    return NextResponse.json({ ok: true, enriched: !!geo });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message || "collect failed" }, { status: 400 });
  }
}