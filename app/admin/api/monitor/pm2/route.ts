export const runtime = "nodejs";

import { execFile, exec } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

async function tryPM2Command(args: string[]) {
  // On Windows, use shell execution to handle PM2 properly
  if (process.platform === "win32") {
    try {
      const command = `pm2 ${args.join(" ")}`;
      const { stdout } = await execAsync(command, { 
        timeout: 10000,
        windowsHide: true
      });
      return { success: true, output: stdout, command: "pm2 (shell)" };
    } catch (err: any) {
      throw new Error(`PM2 shell command failed: ${err.message}`);
    }
  }

  // On Linux, use execFile as before
  const commands = ["pm2"];

  for (const cmd of commands) {
    try {
      const { stdout } = await execFileAsync(cmd, args, { 
        timeout: 10000,
        shell: false
      });
      return { success: true, output: stdout, command: cmd };
    } catch (err: any) {
      if (err.code === "ENOENT") {
        continue;
      }
      console.log(`PM2 command failed with ${cmd}:`, err.code, err.message);
      throw err;
    }
  }
  
  // Try with npx as last resort
  try {
    const { stdout } = await execFileAsync("npx", ["pm2", ...args], { 
      timeout: 15000,
      shell: false
    });
    return { success: true, output: stdout, command: "npx pm2" };
  } catch (err: any) {
    throw new Error("PM2 not available or not working");
  }
}

export async function GET() {
  try {
    const result = await tryPM2Command(["jlist"]);
    const processes = JSON.parse(result.output);
    
    return Response.json({
      available: true,
      processes: processes.map((proc: any) => ({
        pid: proc.pid,
        name: proc.name,
        pm_id: proc.pm_id,
        status: proc.pm2_env?.status || "unknown",
        restart_time: proc.pm2_env?.restart_time || 0,
        unstable_restarts: proc.pm2_env?.unstable_restarts || 0,
        created_at: proc.pm2_env?.created_at,
        cpu: proc.monit?.cpu || 0,
        memory: proc.monit?.memory || 0,
      })),
      command: result.command
    });
  } catch (error: any) {
    return Response.json({
      available: false,
      processes: [],
      error: error.message.includes("PM2 not available") 
        ? "PM2 is not installed or not available on this machine"
        : `PM2 error: ${error.message}`,
      platform: process.platform,
      suggestion: "Try running: pm2 jlist (to test if PM2 works in terminal)"
    });
  }
}