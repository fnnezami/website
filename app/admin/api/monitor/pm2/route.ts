export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { execFile } from "node:child_process";

function execPM2Once(bin: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { windowsHide: true, timeout: 3000 }, (err, stdout, stderr) => {
      if (err) return reject(Object.assign(err, { stderr }));
      resolve(stdout);
    });
  });
}

async function execPM2(args: string[]): Promise<string> {
  const isWin = process.platform === "win32";
  const bins = isWin ? ["pm2.cmd", "pm2"] : ["pm2"];
  let lastErr: any;
  for (const b of bins) {
    try {
      return await execPM2Once(b, args);
    } catch (e) {
      lastErr = e;
      // Try next candidate only if not found
      if ((e as any)?.code !== "ENOENT") break;
    }
  }
  throw lastErr;
}

function normalizePM2Error(e: any): string {
  const msg = String(e?.message || e);
  const stderr = String(e?.stderr || "");
  if (e?.code === "ENOENT") return "PM2 CLI not found on PATH";
  if (/EINVAL/i.test(msg)) return "PM2 CLI cannot be spawned (invalid environment or not available)";
  if (/not found/i.test(stderr)) return "PM2 CLI not found on PATH";
  return msg || "PM2 not available";
}

export async function GET() {
  try {
    const out = await execPM2(["jlist"]); // JSON array of processes
    let list: any[] = [];
    try {
      list = JSON.parse(out || "[]");
    } catch {
      // If PM2 printed non-JSON, treat as unavailable
      return NextResponse.json({ available: false, processes: [], error: "PM2 returned non-JSON output" }, { status: 200 });
    }
    const processes = list.map((p: any) => ({
      id: p.pm_id,
      name: p.name,
      namespace: p.pm2_env?.namespace || "default",
      status: p.pm2_env?.status,
      restarts: p.pm2_env?.unstable_restarts ?? p.pm2_env?.restart_time ?? 0,
      cpu: p.monit?.cpu ?? 0,
      memoryMB: Math.round((p.monit?.memory ?? 0) / 1024 / 1024),
      uptime: p.pm2_env?.pm_uptime || 0,
      node: p.pm2_env?.node_version,
      script: p.pm2_env?.pm_exec_path,
      mode: p.pm2_env?.exec_mode,
    }));
    return NextResponse.json({ available: true, processes }, { status: 200 });
  } catch (e: any) {
    // Graceful: return 200 with available=false so UI can show a hint
    return NextResponse.json(
      { available: false, processes: [], error: normalizePM2Error(e) },
      { status: 200 }
    );
  }
}