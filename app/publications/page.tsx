// /app/publications/page.tsx
import { getEnrichedPublications } from "@/lib/publications";
import CiteDialog from "@/components/CiteDialog";
import AbstractDialog from "@/components/AbstractDialog";

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* ===== BibLaTeX helpers (APA authors) – keep your current helpers here ===== */
/* (Use the same helpers you already have from the last step:
   splitAuthors, nameToApaBib, firstAuthorKey, shortTitleKey,
   guessEntryType, makeBibLaTeX )
*/

function splitAuthors(raw: string): string[] {
  if (!raw) return [];
  const s = raw.trim().replace(/\s+/g, " ");
  if (/\s+and\s+/i.test(s)) return s.split(/\s+and\s+/i).map(t => t.trim()).filter(Boolean);
  if (s.includes(";")) return s.split(/\s*;\s*/).map(t => t.trim()).filter(Boolean);
  if (s.includes(",")) {
    const parts = s.split(/\s*,\s*/).filter(Boolean);
    const everyHasSpace = parts.every((p) => /\s/.test(p));
    if (everyHasSpace) return parts;
    if (parts.length % 2 === 0) {
      const grouped: string[] = [];
      for (let i = 0; i < parts.length; i += 2) grouped.push(`${parts[i]}, ${parts[i + 1]}`);
      return grouped;
    }
    return [s];
  }
  return [s];
}
function nameToApaBib(name: string): string {
  let last = "", given = "";
  if (name.includes(",")) {
    const [l, rest] = name.split(",", 2);
    last = (l || "").trim(); given = (rest || "").trim();
  } else {
    const tokens = name.trim().split(/\s+/);
    if (tokens.length <= 1) return tokens[0] || "";
    last = tokens[tokens.length - 1];
    given = tokens.slice(0, -1).join(" ");
  }
  const initials = given.split(/\s+/).filter(Boolean).map(t =>
    t.split("-").filter(Boolean).map(seg => (seg[0] ? `${seg[0].toUpperCase()}.` : "")).join("-")
  ).filter(Boolean).join(" ");
  const lastFixed = last.split(/\s+/).map(tok =>
    /^(van|von|de|del|da|di|du|la|le)$/i.test(tok) ? tok.toLowerCase()
      : tok[0] ? tok[0].toUpperCase() + tok.slice(1) : tok
  ).join(" ");
  return initials ? `${lastFixed}, ${initials}` : lastFixed;
}
function firstAuthorKey(authorsArr: string[]): string {
  if (!authorsArr.length) return "unknown";
  const lastPart = nameToApaBib(authorsArr[0]).split(",")[0] || "unknown";
  return lastPart.toLowerCase().replace(/[^a-z0-9]+/g, "");
}
function shortTitleKey(title: string): string {
  const t = (title || "").toLowerCase().replace(/[^a-z0-9\s]+/gi, " ").trim();
  const firstTwo = t.split(/\s+/).slice(0, 2).join("");
  return firstTwo.replace(/[^a-z0-9]+/g, "");
}
function guessEntryType(venue: string, doi: string): "article" | "inproceedings" | "online" | "misc" {
  const v = (venue || "").toLowerCase();
  if (/arxiv|osf|preprint/.test(v) || /^10\.48550\//.test(doi)) return "online";
  if (/conference|proceedings|workshop|symposium|conf\./.test(v)) return "inproceedings";
  if (v) return "article";
  return "misc";
}
function makeBibLaTeX(p: any) {
  const authorsArr = splitAuthors(p.authors || "").map(nameToApaBib);
  const year = p.year || "";
  const doi = p.doi || "";
  const url = p.link || "";
  const venue = p.venue || "";
  const type = guessEntryType(venue, doi);
  const key = `${firstAuthorKey(authorsArr)}${year || ""}${shortTitleKey(p.title || "")}` || "entry";
  const authorField = authorsArr.length ? `  author = {${authorsArr.join(" and ")}},\n` : "";
  const venueField =
    type === "article" ? `  journaltitle = {${venue}},\n`
    : type === "inproceedings" ? `  booktitle = {${venue}},\n`
    : venue ? `  howpublished = {${venue}},\n` : "";
  const doiField = doi ? `  doi = {${doi}},\n` : "";
  const urlField = !doi && url ? `  url = {${url}},\n` : "";
  const yearField = year ? `  year = {${year}},\n` : "";
  return `@${type}{${key},
  title = {${p.title || "Untitled"}},
${authorField}${venueField}${yearField}${doiField}${urlField}}`;
}

/* ===== Page ===== */

export default async function PublicationsPage() {
  const pubs = await getEnrichedPublications(false);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Publications</h2>

      <div className="rounded-2xl border bg-white divide-y">
        {pubs.map((p: any, i: number) => {
          const bib = makeBibLaTeX(p);
          const linkHref = p.link || (p.doi ? `https://doi.org/${p.doi}` : "");
          const hasAbstract = Boolean(p.abstract && p.abstract.trim());

          return (
            <article key={p.doi || p.link || i} className="p-4">
              <div className="flex flex-col gap-1">
                <div className="font-medium">{p.title}</div>
                <div className="text-sm text-gray-600">
                  {p.authors ? `${p.authors} · ` : ""}
                  {p.venue ? `${p.venue} · ` : ""}
                  {p.year || ""}
                </div>
                <div className="text-xs text-gray-500">
                  {p.doi ? `DOI: ${p.doi}` : ""}
                  {p.source ? `  •  source: ${p.source}` : ""}
                </div>

                {/* optional teaser of abstract */}
                {hasAbstract && (
                  <p className="mt-2 text-sm text-gray-700 line-clamp-3">
                    {p.abstract}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <AbstractDialog abstract={p.abstract || ""} />
                  <CiteDialog bib={bib} />
                  {linkHref ? (
                    <a
                      href={linkHref}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg bg-black px-3 py-1.5 text-sm text-white hover:opacity-90"
                    >
                      Read paper
                    </a>
                  ) : null}

                  

                  
                </div>
              </div>
            </article>
          );
        })}

        {pubs.length === 0 && (
          <div className="p-6 text-sm text-gray-600">No publications found.</div>
        )}
      </div>
    </div>
  );
}
