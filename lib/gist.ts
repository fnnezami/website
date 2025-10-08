// /lib/gist.ts
export const runtime = "nodejs";

export async function fetchNormalizedResume(): Promise<any> {
  const base = process.env.GIST_RAW_URL?.trim();
  if (!base) throw new Error("GIST_RAW_URL not set in .env.local");

  // cache-bust during dev; keep no-store to avoid CDN caching
  const url = base.includes("?") ? `${base}&_=${Date.now()}` : `${base}?_=${Date.now()}`;

  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json,text/plain;q=0.9,*/*;q=0.8",
      "User-Agent": "ResumeSite/1.0 (+gist raw fetch)",
    },
  });

  const ct = (res.headers.get("content-type") || "").toLowerCase();
  const text = await res.text();

  // If GitHub serves an error/rate-limit/login page, it'll be HTML
  if (ct.includes("text/html") || /^\s*<!doctype html>/i.test(text)) {
    throw new Error(
      `Expected JSON but got non-JSON/HTML.\n` +
      `Check GIST_RAW_URL Raw link:\n${base}\n` +
      `Status: ${res.status}\nContent-Type: ${ct}\n` +
      `Snippet: ${text.slice(0, 160)}`
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `Failed to parse JSON from ${base}\n` +
      `Status: ${res.status}\nContent-Type: ${ct}\n` +
      `Snippet: ${text.slice(0, 160)}`
    );
  }
}
