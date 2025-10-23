export const runtime = "nodejs";

import { execFile, spawn } from "node:child_process";

function execOnce(bin: string, args: string[]) {
  return new Promise<string>((resolve, reject) => {
    execFile(bin, args, { windowsHide: true, timeout: 2000 }, (err, stdout, stderr) => {
      if (err) return reject(Object.assign(err, { stderr }));
      resolve(stdout);
    });
  });
}
async function isPM2Available() {
  const bins = process.platform === "win32" ? ["pm2.cmd", "pm2"] : ["pm2"];
  for (const b of bins) {
    try {
      await execOnce(b, ["-v"]);
      return { ok: true, bin: b };
    } catch (e: any) {
      if (e?.code === "ENOENT") continue;
    }
  }
  return { ok: false, bin: "" };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const nameFilter = searchParams.get("name") || "";
  const idFilter = searchParams.get("id");

  const avail = await isPM2Available();
  if (!avail.ok) {
    // Return SSE 200 with a one-shot status message, not 500
    const stream = new ReadableStream({
      start(controller) {
        const enc = new TextEncoder();
        controller.enqueue(enc.encode(`event: open\ndata: {"ok":false,"reason":"pm2 not available"}\n\n`));
        controller.enqueue(enc.encode(`data: {"unavailable":true,"msg":"PM2 is not installed or not on PATH"}\n\n`));
        controller.close();
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
      status: 200,
    });
  }

  const bin = avail.bin;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const args = ["logs", "--json"];
      if (nameFilter) args.push(nameFilter);

      const child = spawn(bin, args, {
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
        shell: false,
      });

      const write = (obj: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };

      const onLine = (line: string) => {
        line = line.trim();
        if (!line) return;
        let j: any;
        try {
          j = JSON.parse(line);
        } catch {
          return write({ ts: Date.now(), type: "out", id: -1, name: "", msg: line });
        }
        const type = j?.type === "err" ? "err" : "out";
        const pid = j?.process?.pm_id;
        const pname = j?.process?.name || "";
        if (nameFilter && pname !== nameFilter) return;
        if (idFilter && String(pid) !== String(idFilter)) return;
        const msg = typeof j?.data === "string" ? j.data : String(j?.data ?? "");
        write({ ts: Date.now(), type, id: pid, name: pname, msg });
      };

      const buf: { out: string; err: string } = { out: "", err: "" };
      const pump = (chunk: Buffer, key: "out" | "err") => {
        buf[key] += chunk.toString("utf8");
        let idx: number;
        while ((idx = buf[key].indexOf("\n")) >= 0) {
          const line = buf[key].slice(0, idx);
          buf[key] = buf[key].slice(idx + 1);
          onLine(line);
        }
      };

      child.stdout?.on("data", (c) => pump(c as Buffer, "out"));
      child.stderr?.on("data", (c) => pump(c as Buffer, "err"));

      child.on("spawn", () => {
        controller.enqueue(encoder.encode(`event: open\ndata: {"ok":true}\n\n`));
      });
      child.on("error", (err) => {
        controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: String(err) })}\n\n`));
        try { controller.close(); } catch {}
      });
      child.on("close", () => {
        try { controller.close(); } catch {}
      });

      (req as any).signal?.addEventListener?.("abort", () => {
        try { child.kill(); } catch {}
        try { controller.close(); } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
    status: 200,
  });
}