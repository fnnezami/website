// /lib/publications.ts
import { fetchNormalizedResume } from "@/lib/gist";

export const runtime = "nodejs";

const UA = "FarbodResumeSite/1.0 (mailto:you@example.com)";
const memoryCache = new Map<string, any>();
const errorCache = new Map<string, string>();
const CACHE_TTL_MS = 1000 * 60 * 60 * 6;

type CvPub = {
  name?: string; title?: string; doi?: string; url?: string; link?: string;
  authors?: string[] | string; author?: string[] | string;
  publisher?: string; publication?: string;
  releaseDate?: string; year?: string | number;
};

/* ---------- helpers ---------- */
function cleanStr(s?: string) { return (s ?? "").toString().trim(); }

function extractDoi(str?: string): string {
  const s = cleanStr(str);
  if (!s) return "";
  const urlMatch = s.match(/https?:\/\/(?:dx\.)?doi\.org\/([^\s<>"'()]+)\b/i);
  if (urlMatch?.[1]) return urlMatch[1];
  const bareUrlMatch = s.match(/(?:^|\s)(?:dx\.)?doi\.org\/([^\s<>"'()]+)\b/i);
  if (bareUrlMatch?.[1]) return bareUrlMatch[1];
  const doiMatch = s.match(/(?:doi:\s*)?(10\.\d{4,9}\/[^\s<>"'()]+)\b/i);
  if (doiMatch?.[1]) return doiMatch[1];
  return "";
}

function normalizeDoi(raw?: string, fallbackFromLink?: string) {
  const fromDoi = extractDoi(raw);
  if (fromDoi) return fromDoi;
  const fromLink = extractDoi(fallbackFromLink);
  return fromLink || "";
}

function normalizedLink(p: CvPub, doiNorm: string) {
  if (doiNorm) return `https://doi.org/${doiNorm}`;
  const first = cleanStr(p.url) || cleanStr(p.link);
  const token = first.split(/\s+/)[0];
  if (/^(?:dx\.)?doi\.org\//i.test(token)) return `https://${token}`;
  return token;
}

function cacheGet(key: string) {
  const v = memoryCache.get(key);
  if (!v) return null;
  if (Date.now() - v.t > CACHE_TTL_MS) { memoryCache.delete(key); return null; }
  return v.v;
}
function cacheSet(key: string, v: any) { memoryCache.set(key, { v, t: Date.now() }); }

/* ----- abstract helpers ----- */
function stripJatsAndHtml(s: string) {
  // Remove JATS / HTML tags
  const noTags = s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  // Decode a few common entities
  return noTags
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function reconstructOpenAlexAbstract(idx: Record<string, number[]> | null | undefined): string {
  if (!idx || typeof idx !== "object") return "";
  // OpenAlex gives { word: [positions...] }
  let max = 0;
  for (const positions of Object.values(idx)) {
    for (const n of positions) if (n > max) max = n;
  }
  const arr = new Array(max + 1).fill("");
  for (const [word, positions] of Object.entries(idx)) {
    for (const n of positions) arr[n] = word;
  }
  return arr.join(" ").replace(/\s+/g, " ").trim();
}

async function fetchWithTimeout(url: string, opts: RequestInit = {}, ms = 8000) {
  const ac = new AbortController();
  const id = setTimeout(() => ac.abort(), ms);
  try {
    const r = await fetch(url, { ...opts, signal: ac.signal, headers: { "User-Agent": UA, ...(opts.headers || {}) } });
    return r;
  } finally {
    clearTimeout(id);
  }
}

/* ----- external lookups ----- */
async function fetchCrossref(doi: string) {
  const url = `https://api.crossref.org/works/${encodeURIComponent(doi)}`;
  const r = await fetchWithTimeout(url);
  if (!r.ok) throw new Error(`Crossref ${r.status} ${r.statusText}`);
  const j = await r.json(); const m = j?.message;

  const abstractRaw = typeof m?.abstract === "string" ? m.abstract : "";
  const abstract = abstractRaw ? stripJatsAndHtml(abstractRaw) : "";

  return {
    title: Array.isArray(m?.title) ? m.title[0] : m?.title,
    authors: (m?.author || []).map((a: any) =>
      (a?.given || a?.family) ? [a.given, a.family].filter(Boolean).join(" ") : (a?.name || "")
    ).filter(Boolean),
    venue: m?.["container-title"]?.[0] || m?.publisher || "",
    year: m?.issued?.["date-parts"]?.[0]?.[0] || m?.published?.["date-parts"]?.[0]?.[0] || null,
    url: m?.URL || (m?.link && m.link[0]?.URL) || `https://doi.org/${doi}`,
    doi,
    abstract,
    source: "crossref" as const,
  };
}

async function fetchOpenAlex(doi: string) {
  const url = `https://api.openalex.org/works/https://doi.org/${encodeURIComponent(doi)}`;
  const r = await fetchWithTimeout(url);
  if (!r.ok) throw new Error(`OpenAlex ${r.status} ${r.statusText}`);
  const m = await r.json();

  const abs =
    typeof m?.abstract === "string" ? m.abstract :
    reconstructOpenAlexAbstract(m?.abstract_inverted_index);

  return {
    title: m?.title || "",
    authors: (m?.authorships || []).map((a: any) => a?.author?.display_name).filter(Boolean),
    venue: m?.host_venue?.display_name || m?.primary_location?.source?.display_name || "",
    year: m?.publication_year || null,
    url: m?.primary_location?.source?.homepage_url || m?.open_access?.oa_url || m?.doi || "",
    doi: (m?.doi || "").replace(/^https?:\/\/doi\.org\//, ""),
    abstract: abs || "",
    source: "openalex" as const,
  };
}

async function enrichByDoi(doi: string) {
  const key = `doi:${doi.toLowerCase()}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  let data = null;
  try {
    data = await fetchCrossref(doi);
  } catch (e: any) {
    errorCache.set(key, `Crossref failed: ${e?.message || e}`);
    try { data = await fetchOpenAlex(doi); }
    catch (e2: any) {
      errorCache.set(key, `${errorCache.get(key) ?? ""} | OpenAlex failed: ${e2?.message || e2}`);
      data = null;
    }
  }
  if (data) cacheSet(key, data);
  return data;
}

function first<T>(...vals: (T | undefined | null | "")[]) {
  return vals.find(v => v !== undefined && v !== null && v !== "") as T | undefined;
}

/* ---------- main ---------- */
export async function getEnrichedPublications(debug = false) {
  const resume = await fetchNormalizedResume();
  const pubs: CvPub[] =
    (resume?.publications as CvPub[]) ??
    (resume?.data?.publications as CvPub[]) ??
    (Array.isArray(resume?.data) && (resume.data[0] as any)?.publications) ??
    [];

  const results: any[] = [];
  const CONCURRENCY = 6;

  const tasks = pubs.map(async (p) => {
    const doiNorm = normalizeDoi(p.doi, p.link || p.url);
    let enriched: Awaited<ReturnType<typeof enrichByDoi>> = null;

    if (doiNorm) enriched = await enrichByDoi(doiNorm);

    const authors = first(p.authors, p.author, enriched?.authors);
    const authorsStr = Array.isArray(authors) ? authors.join(", ") : (authors || "");

    const title = first(p.title, p.name, enriched?.title) || "Untitled";
    const venue = first(p.publication, p.publisher, enriched?.venue) || "";
    const year = first(p.year, p.releaseDate, enriched?.year);
    const link = normalizedLink(p, doiNorm) || enriched?.url || "";
    const abstract = first<string>(enriched?.abstract, "");

    const key = doiNorm ? `doi:${doiNorm.toLowerCase()}` : undefined;
    const err = key ? errorCache.get(key) : undefined;

    return {
      title,
      authors: authorsStr,
      venue,
      year: year ? String(year).match(/\d{4}/)?.[0] : "",
      doi: doiNorm || "",
      link,
      abstract,
      source: enriched?.source ?? (doiNorm ? "doi" : "cv"),
      _debugError: debug ? err ?? null : undefined,
    };
  });

  for (let i = 0; i < tasks.length; i += CONCURRENCY) {
    const part = await Promise.all(tasks.slice(i, i + CONCURRENCY));
    results.push(...part);
  }

  results.sort((a, b) => {
    const ay = a.year ? Number(a.year) : 0;
    const by = b.year ? Number(b.year) : 0;
    if (ay && by) return by - ay;
    if (ay && !by) return -1;
    if (!ay && by) return 1;
    return String(a.title).localeCompare(String(b.title));
  });

  return results;
}
