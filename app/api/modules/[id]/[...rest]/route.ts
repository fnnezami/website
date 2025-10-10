import { NextResponse } from "next/server";

export const runtime = "nodejs";

async function forward(req: Request, paramsArg: any) {
  // await potentially-thenable params (Next rule)
  const params = paramsArg && typeof paramsArg?.then === "function" ? await paramsArg : paramsArg || {};
  const id = String(params.id || "");
  const segments = params.rest || [];

  if (!id) {
    return NextResponse.json({ ok: false, error: "missing module id" }, { status: 400 });
  }

  try {
    // correct relative path from this file to /modules/<id>/server/route.ts
    // app/api/modules/[id]/[...rest]/route.ts -> ../../../../../modules/<id>/server/route
    const mod = await import(`../../../../../modules/${id}/server/route`);
    const method = (req.method || "GET").toUpperCase();
    const handler = (mod && (mod[method] || mod.default || mod.handle)) as any;
    if (!handler) {
      return NextResponse.json({ ok: false, error: "module has no handler for method" }, { status: 404 });
    }

    const result = await handler(req, { id, segments });

    if (result instanceof Response) return result;
    return NextResponse.json(result);
  } catch (err: any) {
    // return structured JSON so UI can render a nice error (not an alert)
    return NextResponse.json({ ok: false, error: String(err?.message || err), stack: err?.stack }, { status: 500 });
  }
}

export async function GET(req: Request, ctx: { params?: any }) {
  return forward(req, ctx?.params);
}
export async function POST(req: Request, ctx: { params?: any }) {
  return forward(req, ctx?.params);
}
export async function PUT(req: Request, ctx: { params?: any }) {
  return forward(req, ctx?.params);
}
export async function DELETE(req: Request, ctx: { params?: any }) {
  return forward(req, ctx?.params);
}
export async function PATCH(req: Request, ctx: { params?: any }) {
  return forward(req, ctx?.params);
}
export async function OPTIONS(req: Request, ctx: { params?: any }) {
  return forward(req, ctx?.params);
}