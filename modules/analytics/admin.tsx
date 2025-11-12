"use client";

import React, { useEffect, useMemo, useState } from "react";

type Summary = { views: number; unique_clients: number };
type TopPath = { path: string; entity_type: string | null; entity_id: string | null; views: number };
type Point = { bucket_ts: string; views: number };
type Recent = {
  ts: string;
  path: string;
  entity_type: string | null;
  entity_id: string | null;
  referrer_host: string | null;
  ip_country: string | null;
  ip_region: string | null;
  ip_city: string | null;
  ip_company: string | null;
  ip_org: string | null;
  ip_is_private: boolean | null;
  client_id: string | null;
};
type GeoPoint = {
  lat: number;
  lon: number;
  count: number;
  is_private: boolean;
  topCountries: { value: string; count: number }[];
  topCities: { value: string; count: number }[];
  topCompanies: { value: string; count: number }[];
};
type CountryCount = { country: string; count: number };

const ranges = [
  { v: "24h", label: "24h" },
  { v: "7d", label: "7d" },
  { v: "30d", label: "30d" },
  { v: "90d", label: "90d" },
];

export default function AnalyticsAdmin() {
  const [range, setRange] = useState("7d");
  const [entityType, setEntityType] = useState<string>("all");
  const [entityId, setEntityId] = useState<string>("");
  const [includePrivate, setIncludePrivate] = useState<boolean>(true);

  const [summary, setSummary] = useState<Summary | null>(null);
  const [top, setTop] = useState<TopPath[]>([]);
  const [series, setSeries] = useState<Point[]>([]);
  const [recent, setRecent] = useState<Recent[]>([]);
  // Add geo state
  const [geoPoints, setGeoPoints] = useState<GeoPoint[]>([]);
  const [geoUnique, setGeoUnique] = useState<number>(0);
  const [countries, setCountries] = useState<CountryCount[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const bucket = useMemo(() => (range === "24h" ? "hour" : "day"), [range]);

  // Filter geo points based on private IP toggle
  const filteredGeoPoints = useMemo(() => {
    return includePrivate ? geoPoints : geoPoints.filter((p) => !p.is_private);
  }, [geoPoints, includePrivate]);

  // Filter recent visits based on private IP toggle
  const filteredRecent = useMemo(() => {
    return includePrivate ? recent : recent.filter((r) => !r.ip_is_private);
  }, [recent, includePrivate]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const qs = (p: Record<string, any>) =>
        Object.entries(p)
          .filter(([, v]) => v !== undefined && v !== "" && v !== "all")
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
          .join("&");

      // Add includePrivate parameter to API calls
      const [s, t, ts, rv, g] = await Promise.all([
        fetch(`/api/modules/analytics/summary?${qs({ range, includePrivate })}`).then((r) => r.json()),
        fetch(`/api/modules/analytics/top?${qs({ range, entityType, entityId, limit: 20, includePrivate })}`).then((r) => r.json()),
        fetch(`/api/modules/analytics/timeseries?${qs({ range, bucket, entityType, entityId, includePrivate })}`).then((r) => r.json()),
        fetch(`/api/modules/analytics/recent?limit=50&${qs({ includePrivate })}`).then((r) => r.json()),
        fetch(`/api/modules/analytics/geo?${qs({ range, includePrivate })}`).then((r) => r.json()),
      ]);

      if (!s.ok || !t.ok || !ts.ok || !rv.ok || !g.ok)
        throw new Error(s.error || t.error || ts.error || rv.error || g.error || "Load failed");

      // Add debug logging
      console.log("Geo API response:", g);
      console.log("All geo points:", g.data?.points);
      console.log("Points with Berlin or DE:", g.data?.points?.filter((p: any) => 
        (p.lat > 52 && p.lat < 53 && p.lon > 13 && p.lon < 14) || // Berlin coords
        JSON.stringify(p).toLowerCase().includes('berlin') ||
        JSON.stringify(p).toLowerCase().includes('germany')
      ));

      setSummary(s.data);
      setTop(t.data);
      setSeries(ts.data);
      setRecent(rv.data);
      // Set geo data
      setGeoPoints(g.data?.points || []);
      setGeoUnique(g.data?.unique || 0);
      setCountries(g.data?.countries || []);
    } catch (e: any) {
      setErr(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, entityType, entityId, includePrivate]);

  return (
    <div className="space-y-6">
      {/* filters row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-neutral-600">Range</label>
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="border rounded-md px-2 py-1 text-sm"
          >
            {ranges.map((r) => (
              <option key={r.v} value={r.v}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-neutral-600">Entity</label>
          <select
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            className="border rounded-md px-2 py-1 text-sm"
          >
            <option value="all">All</option>
            <option value="page">Page</option>
            <option value="blog">Blog</option>
            <option value="project">Project</option>
          </select>
          <input
            placeholder="Entity ID (optional)"
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            className="border rounded-md px-2 py-1 text-sm"
            style={{ width: 220 }}
          />
        </div>

        {/* Private IP Toggle */}
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includePrivate}
              onChange={(e) => setIncludePrivate(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300"
            />
            <span className="text-sm text-neutral-600">Include private IPs</span>
          </label>
        </div>

        <button
          onClick={load}
          className="px-3 py-2 text-sm rounded-md bg-black text-white"
          disabled={loading}
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
        {err && <div className="text-sm text-red-600">{err}</div>}
      </div>

      {/* Unique visitors map */}
      <div className="rounded-lg border bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-medium">
            Visitor locations ({range})
            {!includePrivate && <span className="text-neutral-500 ml-2">(public IPs only)</span>}
          </div>
          <div className="text-sm text-neutral-600">
            Unique: {geoUnique || "—"}
            {countries?.[0] ? ` • Top country: ${countries[0].country} (${countries[0].count})` : ""}
            <span className="ml-2 text-xs">
              Showing: {filteredGeoPoints.length}/{geoPoints.length} locations
            </span>
          </div>
        </div>
        <WorldMap points={filteredGeoPoints} />
      </div>

      {/* existing cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-neutral-500">Total Views</div>
          <div className="text-2xl font-semibold">{summary?.views ?? "—"}</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-neutral-500">Unique Visitors</div>
          <div className="text-2xl font-semibold">{summary?.unique_clients ?? "—"}</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-neutral-500">Top Path</div>
          <div className="text-sm break-all">
            {top?.[0]?.path ?? "—"} {top?.[0] ? `(${top[0].views})` : ""}
          </div>
        </div>
      </div>

      {/* existing timeseries */}
      <div className="rounded-lg border bg-white p-4">
        <div className="mb-2 text-sm font-medium">Views over time</div>
        <TimeseriesChart points={series} />
      </div>

      {/* existing top paths */}
      <div className="rounded-lg border bg-white p-4">
        <div className="mb-2 text-sm font-medium">Top paths</div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-3">Path</th>
                <th className="py-2 px-3">Type</th>
                <th className="py-2 px-3">Entity ID</th>
                <th className="py-2 px-3">Country</th>
                <th className="py-2 px-3">Company</th>
                <th className="py-2 pl-3 text-right">Views</th>
              </tr>
            </thead>
            <tbody>
              {top.map((r, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-2 pr-3 break-all">{r.path}</td>
                  <td className="py-2 px-3">{r.entity_type || "—"}</td>
                  <td className="py-2 px-3">{r.entity_id || "—"}</td>
                  <td className="py-2 px-3">{(r as any).ip_country || "—"}</td>
                  <td className="py-2 px-3">{(r as any).ip_company || (r as any).ip_org || "—"}</td>
                  <td className="py-2 pl-3 text-right">{r.views}</td>
                </tr>
              ))}
              {!top.length && (
                <tr>
                  <td className="py-4 text-neutral-500" colSpan={6}>
                    No data
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* recent visitors */}
      <div className="rounded-lg border bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-medium">Recent visitors</div>
          <div className="text-xs text-neutral-500">
            Showing: {filteredRecent.length}/{recent.length} visits
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-3">When</th>
                <th className="py-2 px-3">Path</th>
                <th className="py-2 px-3">Country</th>
                <th className="py-2 px-3">City/Region</th>
                <th className="py-2 px-3">Company/Org</th>
                <th className="py-2 px-3">Type</th>
                <th className="py-2 px-3">Client</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecent.map((r, i) => {
                const when = new Date(r.ts).toLocaleString();
                const org = r.ip_company || r.ip_org || "—";
                const cr =
                  r.ip_city || r.ip_region
                    ? `${r.ip_city || ""}${r.ip_city && r.ip_region ? ", " : ""}${r.ip_region || ""}`
                    : "—";
                const ipType = r.ip_is_private ? "Private" : "Public";
                return (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 pr-3 whitespace-nowrap">{when}</td>
                    <td className="py-2 px-3 break-all">{r.path}</td>
                    <td className="py-2 px-3">{r.ip_country || "—"}</td>
                    <td className="py-2 px-3">{cr}</td>
                    <td className="py-2 px-3">{org}</td>
                    <td className="py-2 px-3">
                      <span
                        className={`px-1.5 py-0.5 text-xs rounded ${
                          r.ip_is_private
                            ? "bg-amber-100 text-amber-800"
                            : "bg-green-100 text-green-800"
                        }`}
                      >
                        {ipType}
                      </span>
                    </td>
                    <td className="py-2 px-3">{r.client_id?.slice(0, 8) || "—"}</td>
                  </tr>
                );
              })}
              {!filteredRecent.length && (
                <tr>
                  <td className="py-4 text-neutral-500" colSpan={7}>
                    No data
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TimeseriesChart({ points }: { points: Point[] }) {
  if (!points?.length) return <div className="text-sm text-neutral-500">No data</div>;
  const max = Math.max(...points.map((p) => Number(p.views) || 0)) || 1;

  return (
    <div className="h-40 flex items-end gap-1">
      {points.map((p, i) => {
        const h = (Number(p.views) / max) * 100;
        const ts = new Date(p.bucket_ts);
        return (
          <div key={i} className="flex-1 flex flex-col items-center">
            <div
              className="w-full bg-black/80"
              style={{ height: `${h}%`, borderTopLeftRadius: 3, borderTopRightRadius: 3 }}
              title={`${ts.toLocaleString()} • ${p.views}`}
            />
          </div>
        );
      })}
    </div>
  );
}

// Add lazy loader at top (after imports)
let _maplibre: any = null;
async function loadMapLibre() {
  if (_maplibre) return _maplibre;
  const mod = await import("maplibre-gl");
  _maplibre = mod.default || mod;
  // Inject CSS once
  if (!document.getElementById("__maplibre_css")) {
    const link = document.createElement("link");
    link.id = "__maplibre_css";
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/maplibre-gl@3.5.0/dist/maplibre-gl.css";
    document.head.appendChild(link);
  }
  return _maplibre;
}

// Updated WorldMap with private IP styling
function WorldMap({ points }: { points: GeoPoint[] }) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<any | null>(null);
  const markersRef = React.useRef<any[]>([]);
  const popupRef = React.useRef<any | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!containerRef.current || mapRef.current) return;
      const maplibre = await loadMapLibre();
      if (cancelled) return;
      const map = new maplibre.Map({
        container: containerRef.current,
        style: "https://demotiles.maplibre.org/style.json",
        center: [0, 20],
        zoom: 1.4,
      });
      map.addControl(new maplibre.NavigationControl({ visualizePitch: true }), "top-right");
      map.addControl(new maplibre.AttributionControl({ compact: true }), "bottom-right");
      mapRef.current = map;
      popupRef.current = new maplibre.Popup({ closeButton: false, closeOnClick: false, offset: 12 });
    })();
    return () => {
      cancelled = true;
      for (const m of markersRef.current) m.remove();
      markersRef.current = [];
      popupRef.current?.remove();
      popupRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  React.useEffect(() => {
    const map = mapRef.current;
    const maplibre = _maplibre;
    if (!map || !maplibre) return;

    // Add debug logging for WorldMap
    console.log("Rendering points on map:", points);
    console.log("Berlin/Germany points:", points.filter((p: GeoPoint) => 
      (p.lat > 52 && p.lat < 53 && p.lon > 13 && p.lon < 14) ||
      JSON.stringify(p).toLowerCase().includes('berlin')
    ));

    // Clear old markers
    for (const m of markersRef.current) m.remove();
    markersRef.current = [];

    const max = Math.max(1, ...points.map((p) => p.count || 0));
    const bounds = new maplibre.LngLatBounds();

    for (const p of points) {
      if (typeof p.lat !== "number" || typeof p.lon !== "number") continue;

      const el = document.createElement("div");
      const size = 12 + (p.count / max) * 18;

      // Different styles for private vs public IPs
      const isPrivate = p.is_private;
      const bgColor = isPrivate ? "rgba(245, 158, 11, 0.8)" : "rgba(15, 23, 42, 0.8)"; // amber for private, dark for public
      const borderColor = isPrivate ? "#f59e0b" : "#fff";

      el.style.cssText = `
        width:${size}px;height:${size}px;
        background:${bgColor};
        border:2px solid ${borderColor};
        border-radius:50%;
        box-shadow:0 1px 4px rgba(0,0,0,.35);
        cursor:pointer;
        ${isPrivate ? "border-style: dashed;" : ""}
      `;

      const ipTypeLabel = isPrivate ? "Private Network" : "Public";
      const html = `
        <div style="font-size:12px;line-height:1.3;">
          <div style="font-weight:600;margin-bottom:4px;">
            Visitors: ${p.count}
            <span style="color:${isPrivate ? "#f59e0b" : "#059669"}; margin-left:8px; font-size:10px; padding:2px 4px; background:${isPrivate ? "rgba(245, 158, 11, 0.1)" : "rgba(5, 150, 105, 0.1)"}; border-radius:2px;">
              ${ipTypeLabel}
            </span>
          </div>
          ${p.topCountries?.length ? `<div><span style="color:#6b7280">Countries:</span> ${p.topCountries.map((c) => `${c.value} (${c.count})`).join(", ")}</div>` : ""}
          ${p.topCities?.length ? `<div><span style="color:#6b7280">Cities:</span> ${p.topCities.map((c) => `${c.value} (${c.count})`).join(", ")}</div>` : ""}
          ${p.topCompanies?.length ? `<div><span style="color:#6b7280">Companies:</span> ${p.topCompanies.map((c) => `${c.value} (${c.count})`).join(", ")}</div>` : ""}
          <div style="color:#9ca3af;margin-top:4px;">Lat ${p.lat.toFixed(2)} · Lon ${p.lon.toFixed(2)}</div>
        </div>
      `;

      el.onmouseenter = () => {
        el.style.background = isPrivate ? "rgba(245, 158, 11, 0.9)" : "rgba(0,0,0,0.9)";
        popupRef.current?.setLngLat([p.lon, p.lat]).setHTML(html).addTo(map);
      };
      el.onmouseleave = () => {
        el.style.background = bgColor;
        popupRef.current?.remove();
      };

      const marker = new maplibre.Marker({ element: el, anchor: "center" })
        .setLngLat([p.lon, p.lat])
        .addTo(map);
      markersRef.current.push(marker);
      bounds.extend([p.lon, p.lat]);
    }

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 40, maxZoom: 4, duration: 400 });
    }
  }, [points]);

  return (
    <div className="relative">
      <div ref={containerRef} className="h-[400px] w-full rounded border overflow-hidden" />
      <div className="absolute bottom-2 left-2 bg-white/80 backdrop-blur px-2 py-1 rounded text-[11px] shadow">
        Hover markers for details • Drag • Scroll to zoom
        <div className="mt-1 flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-slate-800 border border-white rounded-full"></div>
            <span>Public</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-amber-500 border-2 border-amber-500 rounded-full" style={{ borderStyle: "dashed" }}></div>
            <span>Private</span>
          </div>
        </div>
      </div>
    </div>
  );
}