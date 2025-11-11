import crypto from "node:crypto";

export type Enriched = {
  country?: string;
  region?: string;
  city?: string;
  lat?: number;
  lon?: number;
  org?: string;
  asn?: string;
  company?: string;
};

const cache = new Map<string, { data: Enriched; exp: number }>();
const TTL_MS = 24 * 60 * 60 * 1000; // 24h

export function hashIp(ip: string | null | undefined, salt = "") {
  if (!ip) return null;
  return crypto.createHash("sha256").update(salt + "::" + ip).digest("hex");
}

function normalizeIp(ip: string) {
  let v = (ip || "").trim();
  const pct = v.indexOf("%"); // strip IPv6 zone id (fe80::1%eth0)
  if (pct > -1) v = v.slice(0, pct);
  // strip :port from IPv4:port or [IPv6]:port -> remove trailing :port if present
  if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(v)) v = v.replace(/:\d+$/, "");
  if (/^\[.+\]:\d+$/.test(v)) v = v.replace(/^\[(.+)\]:(\d+)$/, "$1");
  return v;
}

function getCached(ip: string) {
  const hit = cache.get(ip);
  if (hit && hit.exp > Date.now()) return hit.data;
  if (hit) cache.delete(ip);
  return null;
}
function setCached(ip: string, data: Enriched) {
  cache.set(ip, { data, exp: Date.now() + TTL_MS });
}

async function fetchJson(url: string, timeoutMs = 2500) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) throw new Error("bad status");
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

// ALWAYS attempt enrichment (no sampling, no disable, try both providers)
export async function enrichIp(ip: string) {
  const norm = normalizeIp(ip);
  if (!norm) return null;

  const cached = getCached(norm);
  if (cached) return cached;

  // Provider 1: ipwho.is
  try {
    const j: any = await fetchJson(`https://ipwho.is/${encodeURIComponent(norm)}`);
    if (j?.success) {
      const data: Enriched = {
        country: j.country_code || undefined,
        region: j.region || j.state || undefined,
        city: j.city || undefined,
        lat: typeof j.latitude === "number" ? j.latitude : undefined,
        lon: typeof j.longitude === "number" ? j.longitude : undefined,
        org: j.connection?.org || undefined,
        asn: j.connection?.asn ? "AS" + j.connection.asn : undefined,
        company: j.connection?.org || undefined,
      };
      setCached(norm, data);
      return data;
    }
  } catch {}

  // Provider 2: ipapi.co
  try {
    const j: any = await fetchJson(`https://ipapi.co/${encodeURIComponent(norm)}/json/`);
    if (!j?.error) {
      const data: Enriched = {
        country: j.country_code || undefined,
        region: j.region || j.province || undefined,
        city: j.city || undefined,
        lat: typeof j.latitude === "number" ? j.latitude : undefined,
        lon: typeof j.longitude === "number" ? j.longitude : undefined,
        org: j.org || j.company || undefined,
        asn: j.asn || undefined,
        company: j.company || j.org || undefined,
      };
      setCached(norm, data);
      return data;
    }
  } catch {}

  return null;
}