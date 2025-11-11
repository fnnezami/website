import crypto from "node:crypto";

type Enriched = {
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
const SAMPLE = (() => {
  const v = process.env.ANALYTICS_ENRICH_SAMPLE;
  const f = v ? parseFloat(v) : 1;
  return isFinite(f) && f >= 0 && f <= 1 ? f : 1;
})();
const DISABLED = process.env.ANALYTICS_ENRICH_DISABLE === "1";

export function hashIp(ip: string | null | undefined, salt = "") {
  if (!ip) return null;
  return crypto.createHash("sha256").update(salt + "::" + ip).digest("hex");
}

function shouldEnrich(ip: string) {
  if (DISABLED) return false;
  if (!ip) return false;
  if (ip === "127.0.0.1" || ip.startsWith("192.168.") || ip.startsWith("10.") || ip.startsWith("172.16.")) return false;
  if (SAMPLE < 1 && Math.random() > SAMPLE) return false;
  return true;
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

async function fetchJson(url: string, timeoutMs = 600) {
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

export async function enrichIp(ip: string): Promise<Enriched | null> {
  if (!shouldEnrich(ip)) return null;
  const cached = getCached(ip);
  if (cached) return cached;

  // Provider 1: ipwho.is
  try {
    const j: any = await fetchJson(`https://ipwho.is/${ip}`);
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
      setCached(ip, data);
      return data;
    }
  } catch {}

  // Provider 2: ipapi.co
  try {
    const j: any = await fetchJson(`https://ipapi.co/${ip}/json/`);
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
      setCached(ip, data);
      return data;
    }
  } catch {}

  return null;
}