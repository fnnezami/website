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
  client_id: string | null;
};

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

  const [summary, setSummary] = useState<Summary | null>(null);
  const [top, setTop] = useState<TopPath[]>([]);
  const [series, setSeries] = useState<Point[]>([]);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const bucket = useMemo(() => (range === "24h" ? "hour" : "day"), [range]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const qs = (p: Record<string, any>) =>
        Object.entries(p)
          .filter(([, v]) => v !== undefined && v !== "" && v !== "all")
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
          .join("&");

      const [s, t, ts, rv] = await Promise.all([
        fetch(`/api/modules/analytics/summary?${qs({ range })}`).then((r) => r.json()),
        fetch(`/api/modules/analytics/top?${qs({ range, entityType, entityId, limit: 20 })}`).then((r) => r.json()),
        fetch(`/api/modules/analytics/timeseries?${qs({ range, bucket, entityType, entityId })}`).then((r) => r.json()),
        fetch(`/api/modules/analytics/recent?limit=50`).then((r) => r.json()),
      ]);

      if (!s.ok || !t.ok || !ts.ok || !rv.ok) throw new Error(s.error || t.error || ts.error || rv.error || "Load failed");
      setSummary(s.data);
      setTop(t.data);
      setSeries(ts.data);
      setRecent(rv.data);
    } catch (e: any) {
      setErr(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, entityType, entityId]);

  return (
    <div className="space-y-6">
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

        <button
          onClick={load}
          className="px-3 py-2 text-sm rounded-md bg-black text-white"
          disabled={loading}
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
        {err && <div className="text-sm text-red-600">{err}</div>}
      </div>

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

      <div className="rounded-lg border bg-white p-4">
        <div className="mb-2 text-sm font-medium">Views over time</div>
        <TimeseriesChart points={series} />
      </div>

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

      <div className="rounded-lg border bg-white p-4">
        <div className="mb-2 text-sm font-medium">Recent visitors</div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-3">When</th>
                <th className="py-2 px-3">Path</th>
                <th className="py-2 px-3">Country</th>
                <th className="py-2 px-3">City/Region</th>
                <th className="py-2 px-3">Company/Org</th>
                <th className="py-2 px-3">Client</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r, i) => {
                const when = new Date(r.ts).toLocaleString();
                const org = r.ip_company || r.ip_org || "—";
                const cr =
                  r.ip_city || r.ip_region
                    ? `${r.ip_city || ""}${r.ip_city && r.ip_region ? ", " : ""}${r.ip_region || ""}`
                    : "—";
                return (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 pr-3 whitespace-nowrap">{when}</td>
                    <td className="py-2 px-3 break-all">{r.path}</td>
                    <td className="py-2 px-3">{r.ip_country || "—"}</td>
                    <td className="py-2 px-3">{cr}</td>
                    <td className="py-2 px-3">{org}</td>
                    <td className="py-2 px-3">{r.client_id?.slice(0, 8) || "—"}</td>
                  </tr>
                );
              })}
              {!recent.length && (
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