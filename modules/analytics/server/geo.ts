import { NextResponse } from "next/server";
import { supabaseAdmin, parseRange } from "./_supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Row = {
  ip_hash: string;
  ip_country: string | null;
  ip_city: string | null;
  ip_region: string | null;
  ip_company: string | null;
  ip_org: string | null;
  ip_lat: number | null;
  ip_lon: number | null;
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const { sinceSQL } = parseRange(url.searchParams.get("range"));
    const supabase = supabaseAdmin();

    const now = new Date();
    const since =
      sinceSQL === "1 day"
        ? new Date(now.getTime() - 24 * 3600e3)
        : sinceSQL === "30 days"
        ? new Date(now.getTime() - 30 * 24 * 3600e3)
        : sinceSQL === "90 days"
        ? new Date(now.getTime() - 90 * 24 * 3600e3)
        : new Date(now.getTime() - 7 * 24 * 3600e3);
    const sinceISO = since.toISOString();

    const sel = await supabase
      .from("analytics_events")
      .select("ip_hash, ip_country, ip_city, ip_region, ip_company, ip_org, ip_lat, ip_lon")
      .gte("ts", sinceISO)
      .not("ip_hash", "is", null)
      .range(0, 19999);
    if (sel.error) throw sel.error;

    // Deduplicate unique visitors by ip_hash (take first occurrence with geo)
    const unique = new Map<string, Row>();
    for (const r of (sel.data || []) as Row[]) {
      if (!unique.has(r.ip_hash)) unique.set(r.ip_hash, r);
    }

    // Cluster by rounded lat/lon (0.75 degree ~ 80km)
    const clusterMap = new Map<
      string,
      {
        lat: number;
        lon: number;
        count: number;
        countries: Record<string, number>;
        cities: Record<string, number>;
        companies: Record<string, number>;
      }
    >();

    for (const r of unique.values()) {
      if (typeof r.ip_lat !== "number" || typeof r.ip_lon !== "number") continue;
      const rl = Math.round(r.ip_lat * (1 / 0.75)) * 0.75;
      const ro = Math.round(r.ip_lon * (1 / 0.75)) * 0.75;
      const key = `${rl},${ro}`;
      const c = clusterMap.get(key) || {
        lat: rl,
        lon: ro,
        count: 0,
        countries: {},
        cities: {},
        companies: {},
      };
      c.count += 1;
      if (r.ip_country) c.countries[r.ip_country] = (c.countries[r.ip_country] || 0) + 1;
      const cityRegion =
        r.ip_city || r.ip_region ? `${r.ip_city || ""}${r.ip_city && r.ip_region ? ", " : ""}${r.ip_region || ""}` : "";
      if (cityRegion) c.cities[cityRegion] = (c.cities[cityRegion] || 0) + 1;
      const comp = r.ip_company || r.ip_org || "";
      if (comp) c.companies[comp] = (c.companies[comp] || 0) + 1;
      clusterMap.set(key, c);
    }

    function topN(obj: Record<string, number>, n = 3) {
      return Object.entries(obj)
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(([value, count]) => ({ value, count }));
    }

    const points = Array.from(clusterMap.values()).map((c) => ({
      lat: c.lat,
      lon: c.lon,
      count: c.count,
      topCountries: topN(c.countries),
      topCities: topN(c.cities),
      topCompanies: topN(c.companies),
    }));

    const countriesAgg: Record<string, number> = {};
    for (const p of points) {
      for (const tc of p.topCountries) {
        countriesAgg[tc.value] = (countriesAgg[tc.value] || 0) + tc.count;
      }
    }
    const countries = Object.entries(countriesAgg)
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      ok: true,
      data: {
        unique: unique.size,
        countries,
        points,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message || "geo failed" }, { status: 400 });
  }
}