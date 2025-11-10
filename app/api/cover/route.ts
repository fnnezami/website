import { NextResponse } from "next/server";
import { extractCoverLetter, buildCoverHtml, pdfFromHtml } from "@/lib/renderer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const body = await req.json();
    const cover = extractCoverLetter(body);
    const html = buildCoverHtml(cover);

    const fmt = (url.searchParams.get("format") || "").toLowerCase();
    const accept = (req.headers.get("accept") || "").toLowerCase();
    const wantsPdf = fmt === "pdf" || accept.includes("application/pdf");
    const download = (url.searchParams.get("download") || "") === "1";

    if (wantsPdf) {
      const pdf = await pdfFromHtml(html);
      return new Response(pdf, {
        headers: {
          "content-type": "application/pdf",
          ...(download
            ? { "content-disposition": 'attachment; filename="cover-letter.pdf"' }
            : {}),
          "cache-control": "no-store",
        },
      });
    }

    return new Response(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        ...(download
          ? { "content-disposition": 'attachment; filename="cover-letter.html"' }
          : {}),
        "cache-control": "no-store",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Bad Request" }, { status: 400 });
  }
}