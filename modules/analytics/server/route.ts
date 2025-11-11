import { NextResponse } from "next/server";
import * as collect from "./collect";
import * as summary from "./summary";
import * as top from "./top";
import * as timeseries from "./timeseries";
import * as recent from "./recent";
import * as geo from "./geo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function subPath(req: Request) {
  const u = new URL(req.url);
  return u.pathname.replace(/^.*\/modules\/analytics/, "") || "/";
}

export async function POST(req: Request) {
  const sp = subPath(req);
  if (sp.startsWith("/collect")) return collect.POST(req);
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function GET(req: Request) {
  const sp = subPath(req);
  if (sp.startsWith("/summary")) return summary.GET(req);
  if (sp.startsWith("/top")) return top.GET(req);
  if (sp.startsWith("/timeseries")) return timeseries.GET(req);
  if (sp.startsWith("/recent")) return recent.GET(req);
  if (sp.startsWith("/geo")) return geo.GET(req);
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}