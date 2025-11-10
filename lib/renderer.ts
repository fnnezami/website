import { render as renderResumeWithTheme } from "resumed";
import themeTech from "jsonresume-theme-tech";
import themeTechGer from "jsonresume-theme-tech-ger";
import * as chromium from "@sparticuz/chromium";
import fs from "node:fs";
import path from "node:path";

const DEFAULT_THEME = "jsonresume-theme-tech";
let BROWSER: any = null;

// Static theme map
const THEME_MAP: Record<string, any> = {
  "jsonresume-theme-tech": themeTech,
  tech: themeTech,
  default: themeTech,

  "jsonresume-theme-tech-ger": themeTechGer,
  "tech-ger": themeTechGer,
  german: themeTechGer,
  de: themeTechGer,
};

// Theme loader
export async function loadTheme(name?: string) {
  const key = (name || DEFAULT_THEME).toString().trim().toLowerCase();
  if (THEME_MAP[key]) return THEME_MAP[key];
  try {
    const req: NodeRequire = (eval("require") as any);
    const mod = req(key);
    return (mod as any)?.default ?? mod;
  } catch {
    throw new Error(
      `Theme "${key}" not available. Known: ${Object.keys(THEME_MAP).join(", ")}`
    );
  }
}

export function unwrap<T = any>(x: T | T[]): T {
  return Array.isArray(x) ? (x[0] as any) : x;
}

export function fmt(text?: any) {
  return (text || "").toString().trim();
}

// Replace the existing linkifyHtml implementation with this (no /s flag; uses [\s\S])
function linkifyHtml(html: string) {
  if (!html) return html;

  // Preserve existing anchors (avoid dotAll flag by using [\s\S])
  const anchors: string[] = [];
  html = html.replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, (a) => {
    const i = anchors.length;
    anchors.push(a);
    return `__ANCHOR_${i}__`;
  });

  const punctTrail = /[)\]\.,:;!?]+$/;

  // Emails
  html = html.replace(
    /\b([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/gi,
    (email) => `__EMAIL__${email}__`
  );

  // http(s) URLs
  html = html.replace(/\bhttps?:\/\/[^\s<>"']+/gi, (url) => {
    const clean = url.replace(punctTrail, "");
    const trail = url.slice(clean.length);
    return `__URL__${clean}__${trail}`;
  });

  // www.* URLs
  html = html.replace(/\bwww\.[\w.-]+\.[a-z]{2,}(?:\/[^\s<>"']*)?/gi, (url) => {
    const clean = url.replace(punctTrail, "");
    const trail = url.slice(clean.length);
    return `__URL__https://${clean}__${trail}`;
  });

  // Bare domains
  html = html.replace(
    /\b(?!\w+@)(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<>"']*)?/gi,
    (domain) => {
      const clean = domain.replace(punctTrail, "");
      const trail = domain.slice(clean.length);
      return `__URL__https://${clean}__${trail}`;
    }
  );

  // Restore markers
  html = html
    .replace(/__EMAIL__(.+?)__/g, (_m, email) => `<a href="mailto:${email}">${email}</a>`)
    .replace(/__URL__(.+?)__(.*?)(?=$|\s)/g, (_m, url, trail) => {
      const href = /^[a-z]+:\/\//i.test(url) ? url : `https://${url}`;
      return `<a href="${href}" target="_blank" rel="noopener noreferrer">${url}</a>${trail}`;
    });

  // Restore original anchors, fixing href and adding target/rel safely
  html = html.replace(/__ANCHOR_(\d+)__/g, (_m, idxStr) => {
    const orig = anchors[Number(idxStr)];
    const m = orig.match(/<a\b([^>]*)>([\s\S]*?)<\/a>/i);
    if (!m) return orig;
    let attrs = m[1];
    const body = m[2];

    // Extract href
    const hrefMatch = attrs.match(/href\s*=\s*(['"])(.*?)\1/i);
    let hrefVal = hrefMatch ? hrefMatch[2].trim() : "";

    if (hrefVal && !/^[a-z]+:\/\//i.test(hrefVal)) {
      hrefVal = `https://${hrefVal.replace(/^\/+/, "")}`;
    }

    // Remove existing target/rel to avoid duplicates
    attrs = attrs
      .replace(/\btarget\s*=\s*(['"]).*?\1/gi, "")
      .replace(/\brel\s*=\s*(['"]).*?\1/gi, "")
      .trim();

    // If href was missing, keep original
    const hrefAttr = hrefVal ? `href="${hrefVal}"` : "";

    const finalAttrs = [hrefAttr, attrs, 'target="_blank"', 'rel="noopener noreferrer"']
      .filter(Boolean)
      .join(" ");

    return `<a ${finalAttrs}>${body}</a>`;
  });

  return html;
}

// HTML from resume JSON + theme
export async function renderResumeHtmlFromData(data: any, themeName?: string) {
  if (!data || typeof data !== "object") throw new Error("Invalid resume JSON body.");
  const theme = await loadTheme(themeName);
  const rawMaybe: any = renderResumeWithTheme(data, theme); // may be string or Promise<string>
  const raw: string = await Promise.resolve(rawMaybe);
  return linkifyHtml(raw);
}

// Cover letter HTML
export function buildCoverHtml(cover: any) {
  const c = cover?.content || {};
  const rec = c.recipient || {};
  const app = c.applicant || {};
  const body = c.body || {};

  const company = fmt(rec.company);
  const position = fmt(rec.position);

  const name = fmt(app.name);
  const address = fmt(app.address);
  const email = fmt(app.email);
  const phone = fmt(app.phone);

  const intro = fmt(body.introduction);
  const fit = fmt(body.fit);
  const value = fmt(body.value);
  const closing = fmt(body.closing);
  const salutation = fmt(body.salutation);

  const today = new Date().toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<style>
  body { font-family: "Times New Roman", Times, serif; font-size:11.5pt; line-height:1.5; margin:1.5cm; color:#000; }
  header { margin-bottom:1.2em; }
  .name { font-size:12pt; font-weight:700; }
  .contact { font-size:10pt; color:#333; }
  .meta { margin:1em 0; font-size:10pt; color:#333; }
  p { margin:0.6em 0; text-align:justify; }
  footer { margin-top:1.5em; }
  .sig { margin-top:1em; font-weight:700; }
  @page { size:A4; margin:12mm; }
</style>
</head>
<body>
<header>
  <div class="name">${name || ""}</div>
  <div class="contact">${address || ""}</div>
  <div class="contact">${
    email
      ? `<a href="mailto:${email}">${email}</a>`
      : ""
  }${
    email && phone ? " · " : ""
  }${
    phone ? `<a href="tel:${phone.replace(/[^+0-9]/g,"")}">${phone}</a>` : ""
  }</div>
</header>
<div class="meta">${today}</div>
<div class="meta">
  ${company ? `${company}<br/>` : ""}${position ? `Re: ${position}<br/>` : ""}
</div>
${intro ? `<p>${intro}</p>` : ""}
${fit ? `<p>${fit}</p>` : ""}
${value ? `<p>${value}</p>` : ""}
${closing ? `<p>${closing}</p>` : ""}
${salutation ? `<p>${salutation}</p>` : ""}
<footer><div class="sig">${name || ""}</div></footer>
</body>
</html>`;
}

export function extractCoverLetter(body: any) {
  const node = unwrap(body);
  if (node?.type === "cover_letter") return node;
  if (node?.content || node?.recipient || node?.applicant || node?.body) {
    return { type: "cover_letter", content: node.content ? node.content : node };
  }
  throw new Error("Invalid cover letter JSON body.");
}

// Browser fallback chain
function findLocalChrome() {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/opt/google/chrome/chrome",
  ].filter(Boolean);
  for (const p of candidates) {
    try {
      if (p && fs.existsSync(p)) return p;
    } catch {}
  }
  return null;
}

async function launchWith(options: any) {
  const puppeteerCore = await import("puppeteer-core").then((m: any) => m.default || m);
  return puppeteerCore.launch(options);
}

export async function getBrowser() {
  if (BROWSER && BROWSER.process && BROWSER.process() && !BROWSER.process().killed)
    return BROWSER;

  // Try serverless chromium
  try {
    const execMaybe = chromium.executablePath;
    const execPath = typeof execMaybe === "function" ? await execMaybe() : execMaybe;
    if (typeof execPath === "string" && fs.existsSync(execPath)) {
      BROWSER = await launchWith({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: execPath,
        headless: chromium.headless,
      });
      return BROWSER;
    }
  } catch {}

  // System Chrome
  const localChrome = findLocalChrome();
  if (localChrome) {
    BROWSER = await launchWith({
      executablePath: localChrome,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    return BROWSER;
  }

  // Bundled puppeteer
  try {
    const puppeteerFull = await import("puppeteer").then((m: any) => m.default || m);
    BROWSER = await puppeteerFull.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    return BROWSER;
  } catch {
    throw new Error(
      "No Chromium available. Install Chrome or keep @sparticuz/chromium / puppeteer installed."
    );
  }
}

export async function pdfFromHtml(html: string) {
  const browser = await getBrowser();
  let page: any;
  try {
    page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const buf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "12mm", right: "12mm", bottom: "12mm", left: "12mm" },
    });
    try { await page.close({ runBeforeUnload: true }); } catch {}
    return buf;
  } catch (err) {
    try { if (page) await page.close({ runBeforeUnload: true }); } catch {}
    throw err;
  }
}