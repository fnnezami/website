export const runtime = "nodejs";

import { spawn, exec } from "node:child_process";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const nameFilter = searchParams.get("name") || "";

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      let closed = false;

      const write = (obj: any) => {
        if (closed) return; // Don't write if stream is closed
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        } catch (error) {
          // Stream is closed, mark as closed to prevent further writes
          closed = true;
        }
      };

      const safeClose = () => {
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {
            // Already closed
          }
        }
      };

      let child: any = null;
      let connected = false;

      const startPM2Logs = () => {
        const args = ["logs", "--lines", "50", "--raw"];
        if (nameFilter) args.push(nameFilter);

        if (process.platform === "win32") {
          // Use shell execution on Windows
          const command = `pm2 ${args.join(" ")}`;
          child = exec(command, { windowsHide: true });
        } else {
          // Use spawn on Linux
          child = spawn("pm2", args, {
            stdio: ["ignore", "pipe", "pipe"],
            shell: false,
          });
        }

        let hasOutput = false;
        let lineCount = 0;

        const processLine = (line: string, isError = false) => {
          if (closed) return; // Don't process if stream is closed
          
          line = line.trim();
          if (!line) return;
          
          hasOutput = true;
          lineCount++;
          
          write({ 
            ts: Date.now(), 
            type: isError ? "err" : "out", 
            id: lineCount, 
            name: nameFilter || "system", 
            msg: line 
          });
        };

        let stdout = "";
        let stderr = "";

        child.stdout?.on("data", (data: Buffer) => {
          if (closed) return;
          
          stdout += data.toString();
          const lines = stdout.split('\n');
          stdout = lines.pop() || "";
          lines.forEach((line: string) => processLine(line, false));
        });

        child.stderr?.on("data", (data: Buffer) => {
          if (closed) return;
          
          stderr += data.toString();
          const lines = stderr.split('\n');
          stderr = lines.pop() || "";
          lines.forEach((line: string) => processLine(line, true));
        });

        child.on("spawn", () => {
          if (closed) return;
          
          if (!connected) {
            connected = true;
            controller.enqueue(encoder.encode(`event: open\ndata: {"ok":true}\n\n`));
            write({ 
              ts: Date.now(), 
              type: "out", 
              id: -1, 
              name: "system", 
              msg: `Connected to PM2 logs${nameFilter ? ` for ${nameFilter}` : ""}` 
            });
          }
        });

        child.on("error", (err: Error) => {
          if (closed) return;
          
          if (!connected) {
            controller.enqueue(encoder.encode(`event: open\ndata: {"ok":false,"reason":"pm2_error"}\n\n`));
          }
          write({ 
            ts: Date.now(), 
            type: "err", 
            id: -1, 
            name: "system", 
            msg: `PM2 error: ${err.message}` 
          });
          safeClose();
        });

        child.on("close", (code: number) => {
          if (closed) return;
          
          // Process remaining data
          if (stdout.trim()) processLine(stdout, false);
          if (stderr.trim()) processLine(stderr, true);

          if (connected) {
            write({ 
              ts: Date.now(), 
              type: "out", 
              id: -1, 
              name: "system", 
              msg: `PM2 logs ended (${lineCount} lines, exit code: ${code})` 
            });
          } else if (!hasOutput) {
            controller.enqueue(encoder.encode(`event: open\ndata: {"ok":false,"reason":"no_output"}\n\n`));
            write({ 
              ts: Date.now(), 
              type: "err", 
              id: -1, 
              name: "system", 
              msg: "PM2 is not available on this machine" 
            });
          }
          safeClose();
        });
      };

      // Start PM2 logs
      startPM2Logs();

      // Handle client disconnect
      req.signal?.addEventListener("abort", () => {
        closed = true;
        if (child) {
          try { 
            child.kill(); 
          } catch {}
        }
        safeClose();
      });

      // Cleanup on controller cancel
      return () => {
        closed = true;
        if (child) {
          try { 
            child.kill(); 
          } catch {}
        }
      };
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