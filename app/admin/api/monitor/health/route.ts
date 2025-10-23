export const runtime = "nodejs";

import os from "os";
import v8 from "v8";
import { NextResponse } from "next/server";

export async function GET() {
  const mem = process.memoryUsage();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();

  // Collect external IPv4 addresses
  const ifaces = os.networkInterfaces() || {};
  const ips: string[] = [];
  for (const key of Object.keys(ifaces)) {
    for (const ni of ifaces[key] || []) {
      if (!ni) continue;
      const fam = (ni as any).family;
      const isIPv4 = fam === "IPv4" || fam === 4;
      if (isIPv4 && !ni.internal && ni.address) ips.push(ni.address);
    }
  }

  const heapLimitMB = Math.round(v8.getHeapStatistics().heap_size_limit / 1024 / 1024);

  const data = {
    timestamp: Date.now(),
    uptimeSec: Math.floor(process.uptime()),
    nodeVersion: process.version,
    pid: process.pid,
    platform: process.platform,
    arch: process.arch,
    hostname: os.hostname(),
    ips, // added

    memoryMB: {
      rss: Math.round(mem.rss / 1024 / 1024),
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
      external: Math.round((mem as any).external / 1024 / 1024) || 0,
      heapLimitMB, // added
    },
    system: {
      totalMemMB: Math.round(totalMem / 1024 / 1024),
      freeMemMB: Math.round(freeMem / 1024 / 1024),
      loadAvg: os.loadavg(),
      cpuCount: os.cpus()?.length || 0,
      cpuModel: os.cpus()?.[0]?.model || "",
    },
  };

  return NextResponse.json(data);
}