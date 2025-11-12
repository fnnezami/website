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
  isPrivate?: boolean;
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

function isPrivateIp(ip: string): boolean {
  // Check IPv4 private ranges
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
    const parts = ip.split('.').map(Number);
    const [a, b, c, d] = parts;
    
    // Check if all parts are valid (0-255)
    if (parts.some(part => part < 0 || part > 255)) return false;
    
    return (
      a === 10 || // 10.0.0.0/8
      (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
      (a === 192 && b === 168) || // 192.168.0.0/16
      a === 127 || // 127.0.0.0/8 (localhost)
      (a === 169 && b === 254) // 169.254.0.0/16 (link-local)
    );
  }
  
  // Check IPv6 private ranges (simplified)
  if (ip.includes(':')) {
    const lower = ip.toLowerCase();
    return (
      lower.startsWith('::1') || // localhost
      lower.startsWith('fe80:') || // link-local
      lower.startsWith('fc00:') || // unique local
      lower.startsWith('fd00:') || // unique local
      lower.startsWith('::ffff:') // IPv4-mapped
    );
  }
  
  return false;
}

async function getServerGeolocation(): Promise<{ country?: string; region?: string; city?: string; lat?: number; lon?: number }> {
  // Try to get server's public IP and location
  try {
    // Get server's public IP
    const ipResponse = await fetchJson('https://api.ipify.org?format=json');
    if (ipResponse?.ip) {
      // Get location for server's public IP
      const locationResponse = await fetchJson(`https://ipwho.is/${encodeURIComponent(ipResponse.ip)}`);
      if (locationResponse?.success) {
        return {
          country: locationResponse.country_code || undefined,
          region: locationResponse.region || locationResponse.state || undefined,
          city: locationResponse.city || undefined,
          lat: typeof locationResponse.latitude === "number" ? locationResponse.latitude : undefined,
          lon: typeof locationResponse.longitude === "number" ? locationResponse.longitude : undefined,
        };
      }
    }
  } catch {}
  
  // Fallback to default location (you can customize this)
  return {
    country: "US",
    region: "Unknown",
    city: "Private Network",
    lat: undefined,
    lon: undefined,
  };
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

  // Handle private IPs
  if (isPrivateIp(norm)) {
    const serverLocation = await getServerGeolocation();
    const data: Enriched = {
      ...serverLocation,
      org: "Private Network",
      asn: undefined,
      company: undefined, // Explicitly not a company
      isPrivate: true,
    };
    setCached(norm, data);
    return data;
  }

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
        isPrivate: false,
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
        isPrivate: false,
      };
      setCached(norm, data);
      return data;
    }
  } catch {}

  return null;
}