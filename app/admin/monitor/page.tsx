"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type Health = {
  timestamp: number;
  uptimeSec: number;
  nodeVersion: string;
  pid: number;
  platform: string;
  arch: string;
  hostname?: string;
  ips?: string[];
  memoryMB: { rss: number; heapUsed: number; heapTotal: number; external: number; heapLimitMB: number };
  system: { totalMemMB: number; freeMemMB: number; loadAvg: number[]; cpuCount: number; cpuModel: string };
};
type Proc = {
  id: number; name: string; namespace: string; status: string; restarts: number;
  cpu: number; memoryMB: number; uptime: number; node: string; script: string; mode: string;
};

export default function MonitorPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [procs, setProcs] = useState<Proc[]>([]);
  const [selected, setSelected] = useState<{ name?: string; id?: number }>({});
  const [logs, setLogs] = useState<{ ts: number; type: "out" | "err"; id: number; name: string; msg: string }[]>([]);
  const [paused, setPaused] = useState(false);
  const [pm2Available, setPm2Available] = useState<boolean | null>(null);
  // Strong, accessible label color (fallbacks to main text color)
  const labelColor = "var(--label-color, var(--text-color, #111827))";
  const logRef = useRef<HTMLPreElement | null>(null);
  const esRef = useRef<EventSource | null>(null);

  // Poll health + processes
  useEffect(() => {
    let t: any;
    const tick = async () => {
      try {
        const [h, p] = await Promise.all([
          fetch("/admin/api/monitor/health", { cache: "no-store" }).then((r) => r.json()),
          fetch("/admin/api/monitor/pm2", { cache: "no-store" }).then((r) => r.json()),
        ]);
        setHealth(h);
        setProcs(p.processes || []);
        setPm2Available(Boolean(p.available));
      } catch {
        setPm2Available(false);
      }
      t = setTimeout(tick, 5000);
    };
    tick();
    return () => clearTimeout(t);
  }, []);

  // Connect logs SSE only if PM2 is available
  useEffect(() => {
    if (pm2Available === false || paused) {
      esRef.current?.close();
      esRef.current = null;
      return;
    }
    if (pm2Available !== true) return;

    const qs = new URLSearchParams();
    if (selected.name) qs.set("name", selected.name);
    if (selected.id != null) qs.set("id", String(selected.id));
    const url = "/admin/api/monitor/pm2/logs" + (qs.toString() ? `?${qs}` : "");

    const es = new EventSource(url);
    esRef.current = es;

    es.onmessage = (ev) => {
      try {
        const j = JSON.parse(ev.data);
        if (j?.unavailable) return; // ignore one-shot notice
        setLogs((arr) => [...arr, j].slice(-1000));
      } catch {}
    };
    es.onerror = () => {
      setTimeout(() => {
        esRef.current?.close();
        esRef.current = null;
      }, 500);
    };
    return () => {
      es.close();
      esRef.current = null;
    };
  }, [selected.name, selected.id, paused, pm2Available]);

  useEffect(() => {
    // auto-scroll
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [logs.length]);

  const memUsedPct = useMemo(() => {
    if (!health) return 0;
    const { totalMemMB, freeMemMB } = health.system;
    return Math.round(((totalMemMB - freeMemMB) / Math.max(1, totalMemMB)) * 100);
  }, [health]);

  function fmtUptime(msOrSec: number) {
    const s = msOrSec > 10_000 ? Math.floor(msOrSec / 1000) : Math.floor(msOrSec);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    return `${d}d ${h}h ${m}m ${ss}s`;
  }

  function pct(n: number, d: number) {
    if (!d) return 0;
    return Math.max(0, Math.min(100, Math.round((n / d) * 100)));
  }
  function fmtMB(n: number) {
    return `${n} MB`;
  }
  function hueFromPct(p: number) {
    // 120 (green) -> 0 (red)
    const clamped = Math.max(0, Math.min(100, p));
    return 120 - Math.round((120 * clamped) / 100);
  }
  function Bar({ valuePct, width = 24, title }: { valuePct: number; width?: number; title?: string }) {
    const filled = Math.round((valuePct / 100) * width);
    const color = `hsl(${hueFromPct(valuePct)} 70% 45%)`;
    const emptyColor = "var(--border-color, #e5e7eb)";
    return (
      <div title={title} style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", lineHeight: 1 }}>
        <span aria-hidden="true">
          <span style={{ color }}>{Array(filled).fill("|").join("")}</span>
          <span style={{ color: emptyColor }}>{Array(Math.max(0, width - filled)).fill("|").join("")}</span>
        </span>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, display: "grid", gap: 16, gridTemplateColumns: "1fr", color: "var(--text-color, #111827)" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Server Monitor</h1>

      {/* Health */}
      <div style={{ background: "var(--surface, #fff)", border: "1px solid var(--border-color, #e5e7eb)", borderRadius: 12, padding: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Health</div>
        {health ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 12, fontSize: 14 }}>
            <div>Host: <strong>{health.hostname || "-"}</strong></div>
            <div>Node: <strong>{health.nodeVersion}</strong></div>
            <div>PID: <strong>{health.pid}</strong></div>
            <div>Uptime: <strong>{fmtUptime(health.uptimeSec)}</strong></div>
            <div>Platform: <strong>{health.platform}/{health.arch}</strong></div>
            <div>CPU: <strong>{health.system.cpuModel}</strong> x{health.system.cpuCount}</div>
            <div style={{ gridColumn: "1 / -1" }}>
              IPs: <strong>{(health.ips || []).join(", ") || "-"}</strong>
            </div>

            {/* System RAM */}
            <div style={{ gridColumn: "1 / -1", marginTop: 4 }}>
              <div style={{ marginBottom: 4, fontWeight: 600 }}>System RAM</div>
              {(() => {
                const usedMB = Math.max(0, health.system.totalMemMB - health.system.freeMemMB);
                const p = pct(usedMB, health.system.totalMemMB);
                return (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <div>{fmtMB(usedMB)} used of {fmtMB(health.system.totalMemMB)} ({p}%)</div>
                    </div>
                    <Bar valuePct={p} title={`System RAM ${p}%`} />
                  </>
                );
              })()}
            </div>

            {/* Process RSS */}
            <div style={{ gridColumn: "1 / -1", marginTop: 4 }}>
              <div style={{ marginBottom: 4, fontWeight: 600 }}>Process RSS</div>
              {(() => {
                const used = health.memoryMB.rss;
                const p = pct(used, health.system.totalMemMB);
                return (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <div>{fmtMB(used)} of system {fmtMB(health.system.totalMemMB)} ({p}%)</div>
                    </div>
                    <Bar valuePct={p} title={`RSS ${p}% of system`} />
                  </>
                );
              })()}
            </div>

            {/* Node Heap */}
            <div style={{ gridColumn: "1 / -1", marginTop: 4 }}>
              <div style={{ marginBottom: 4, fontWeight: 600 }}>Node.js Heap</div>
              {(() => {
                const used = health.memoryMB.heapUsed;
                const cap = Math.max(health.memoryMB.heapLimitMB || health.memoryMB.heapTotal, health.memoryMB.heapTotal);
                const p = pct(used, cap);
                return (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <div>{fmtMB(used)} of {fmtMB(cap)} ({p}%)</div>
                    </div>
                    <Bar valuePct={p} title={`Heap ${p}%`} />
                  </>
                );
              })()}
            </div>

            {/* Load average */}
            <div style={{ gridColumn: "1 / -1", marginTop: 4 }}>
              <div style={{ marginBottom: 4, fontWeight: 600 }}>Load Average</div>
              <div style={{ color: labelColor }}>
                {health.system.loadAvg.map((n) => n.toFixed(2)).join("  /  ")} {process.platform === "win32" ? "(not meaningful on Windows)" : ""}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 14 }}>Loading…</div>
        )}
      </div>

      {/* PM2 processes */}
      <div style={{ background: "var(--surface, #fff)", border: "1px solid var(--border-color, #e5e7eb)", borderRadius: 12, padding: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <div style={{ fontWeight: 600 }}>PM2 Processes</div>
          <div style={{ marginLeft: "auto", fontSize: 12, color: labelColor }}>
            Click a row to filter logs by that process
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: "1px solid var(--border-color, #e5e7eb)" }}>ID</th>
                <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: "1px solid var(--border-color, #e5e7eb)" }}>Name</th>
                <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: "1px solid var(--border-color, #e5e7eb)" }}>Status</th>
                <th style={{ textAlign: "right", padding: "8px 10px", borderBottom: "1px solid var(--border-color, #e5e7eb)" }}>CPU%</th>
                <th style={{ textAlign: "right", padding: "8px 10px", borderBottom: "1px solid var(--border-color, #e5e7eb)" }}>Mem (MB)</th>
                <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: "1px solid var(--border-color, #e5e7eb)" }}>Uptime</th>
                <th style={{ textAlign: "right", padding: "8px 10px", borderBottom: "1px solid var(--border-color, #e5e7eb)" }}>Restarts</th>
                <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: "1px solid var(--border-color, #e5e7eb)" }}>Mode</th>
              </tr>
            </thead>
            <tbody>
              {procs.map((p) => (
                <tr
                  key={`${p.namespace}:${p.id}:${p.name}`}
                  onClick={() => setSelected({ id: p.id, name: p.name })}
                  style={{ cursor: "pointer", borderBottom: "1px solid var(--border-color, #f1f5f9)" }}
                >
                  <td style={{ padding: "8px 10px" }}>{p.id}</td>
                  <td style={{ padding: "8px 10px" }}>{p.name}</td>
                  <td style={{ padding: "8px 10px" }}>{p.status}</td>
                  <td style={{ padding: "8px 10px", textAlign: "right" }}>{p.cpu}</td>
                  <td style={{ padding: "8px 10px", textAlign: "right" }}>{p.memoryMB}</td>
                  <td style={{ padding: "8px 10px" }}>{p.uptime ? new Date(p.uptime).toLocaleString() : "-"}</td>
                  <td style={{ padding: "8px 10px", textAlign: "right" }}>{p.restarts}</td>
                  <td style={{ padding: "8px 10px" }}>{p.mode}</td>
                </tr>
              ))}
              {procs.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: 12, color: labelColor }}>
                    {pm2Available === false
                      ? "PM2 is not available or not running on this server."
                      : "No processes found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Logs */}
      <div style={{ background: "var(--surface, #fff)", border: "1px solid var(--border-color, #e5e7eb)", borderRadius: 12, padding: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <div style={{ fontWeight: 600 }}>Live Logs</div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => setPaused((v) => !v)}
              style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border-color, #e5e7eb)", background: "var(--surface, #fff)", cursor: "pointer" }}
            >
              {paused ? "Resume" : "Pause"}
            </button>
            <button
              type="button"
              onClick={() => setLogs([])}
              style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border-color, #e5e7eb)", background: "var(--surface, #fff)", cursor: "pointer" }}
            >
              Clear
            </button>
          </div>
        </div>
        <div style={{ fontSize: 12, color: labelColor, marginBottom: 6 }}>
          {selected.name ? `Filtering by: ${selected.name}` : "Showing all PM2 processes"}
        </div>
        <pre
          ref={logRef}
          style={{
            height: 340,
            overflow: "auto",
            background: "var(--surface-2, #0b1020)",
            color: "#e8eefc",
            borderRadius: 8,
            padding: 10,
            margin: 0,
            border: "1px solid var(--border-color, #1f2a44)",
            whiteSpace: "pre-wrap",
          }}
        >
          {logs.map((l, i) => {
            const ts = new Date(l.ts).toISOString().split("T")[1].replace("Z", "");
            const color = l.type === "err" ? "#ffb4b4" : "#9fe7a4";
            return (
              <span key={i} style={{ display: "block" }}>
                <span style={{ color: "#7aa2f7" }}>[{ts}]</span>{" "}
                <span style={{ color }}>{l.type.toUpperCase()}</span>{" "}
                <span style={{ color: "#a3aed0" }}>{l.name}({l.id})</span>: {l.msg.replace(/\r?\n$/, "")}
              </span>
            );
          })}
        </pre>
      </div>
    </div>
  );
}