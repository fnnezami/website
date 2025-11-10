import { NextResponse } from "next/server";
import { fetchNormalizedResume } from "@/lib/gist";
import {
  renderResumeHtmlFromData,
  pdfFromHtml,
} from "@/lib/renderer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function wantsPdf(req: Request, url: URL) {
  const fmt = (url.searchParams.get("format") || "").toLowerCase();
  const accept = (req.headers.get("accept") || "").toLowerCase();
  return fmt === "pdf" || accept.includes("application/pdf");
}

function asAttachment(url: URL) {
  return (url.searchParams.get("download") || "") === "1";
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const theme = url.searchParams.get("theme") || undefined;
    const resume = await fetchNormalizedResume();
    const html = await renderResumeHtmlFromData(resume, theme);

    if (wantsPdf(req, url)) {
      const pdf = await pdfFromHtml(html);
      return new Response(pdf, {
        headers: {
          "content-type": "application/pdf",
          ...(asAttachment(url)
            ? { "content-disposition": 'attachment; filename="resume.pdf"' }
            : {}),
          "cache-control": "no-store",
        },
      });
    }

    return new Response(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        ...(asAttachment(url)
          ? { "content-disposition": 'attachment; filename="resume.html"' }
          : {}),
        "cache-control": "no-store",
      },
    });
  } catch (e: any) {
    console.error("render/resume GET error:", e);
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const theme = url.searchParams.get("theme") || undefined;
    const body = await req.json();
    const resume = Array.isArray(body) ? body[0] : body;
    const html = await renderResumeHtmlFromData(resume, theme);

    if (wantsPdf(req, url)) {
      const pdf = await pdfFromHtml(html);
      return new Response(pdf, {
        headers: {
          "content-type": "application/pdf",
          ...(asAttachment(url)
            ? { "content-disposition": 'attachment; filename="resume.pdf"' }
            : {}),
          "cache-control": "no-store",
        },
      });
    }

    return new Response(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        ...(asAttachment(url)
          ? { "content-disposition": 'attachment; filename="resume.html"' }
          : {}),
        "cache-control": "no-store",
      },
    });
  } catch (e: any) {
    console.error("render/resume POST error:", e);
    return NextResponse.json({ error: e?.message || "Bad Request" }, { status: 400 });
  }
}