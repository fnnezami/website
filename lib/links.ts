// /lib/links.ts
export type WebLink = { href: string; label: string };

function normalizeHref(href: string) {
  return href.trim().replace(/\/+$/, "").toLowerCase();
}

export function collectUniqueLinks(resume: any): WebLink[] {
  const out: WebLink[] = [];
  const seen = new Set<string>();

  const basicsUrl = resume?.basics?.url || resume?.basics?.website;
  if (basicsUrl) {
    const key = normalizeHref(basicsUrl);
    if (!seen.has(key)) {
      seen.add(key);
      out.push({ href: basicsUrl, label: "Website" });
    }
  }

  const profiles: any[] = Array.isArray(resume?.basics?.profiles) ? resume.basics.profiles : [];
  for (const p of profiles) {
    const url = (p?.url || p?.networkUrl || "").trim();
    if (!url) continue;
    const key = normalizeHref(url);
    if (seen.has(key)) continue;

    seen.add(key);
    const network = (p?.network || "").toString().trim();
    const username = (p?.username || "").toString().trim();
    const label = network || username || "Profile";
    out.push({ href: url, label });
  }

  return out;
}
