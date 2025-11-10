// components/ProfileHeader.tsx
"use client";

import Image from "next/image";

type Props = {
  name: string;
  title?: string;
  about?: string;    // we'll pass basics.summary here
  summary?: string;  // and also here (belt & suspenders)
  photoUrl?: string;
  links?: { label: string; href: string }[];
};

function normalizeHref(href: string) {
  return href.trim().toLowerCase().replace(/\/+$/, "");
}

function ensureAbsolute(href: string) {
  const trimmed = href.trim();
  if (/^(https?:|mailto:|tel:|#)/i.test(trimmed)) return trimmed; // already absolute or special
  if (/^\/\//.test(trimmed)) return `https:${trimmed}`; // protocol-relative
  // Common domains without scheme
  if (/^(www\.|linkedin\.|x\.com|twitter\.|github\.|gitlab\.|medium\.|youtube\.|tiktok\.|facebook\.|instagram\.)/i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  // If it looks like a domain (contains a dot and no spaces)
  if (/^[^\s]+\.[^\s]+/.test(trimmed) && !trimmed.startsWith("/")) {
    return `https://${trimmed}`;
  }
  // Leave internal relative paths as-is
  return trimmed;
}

export default function ProfileHeader({
  name,
  title,
  about,
  summary,
  photoUrl,
  links = [],
}: Props) {
  // use exactly what we’re given — no placeholder logic
  const aboutText = (about ?? summary ?? "") as string;

  const dedupedLinks = (() => {
    const seen = new Set<string>();
    const out: { label: string; href: string; _key: string }[] = [];
    for (const l of links) {
      const raw = (l?.href ?? "").trim();
      if (!raw) continue;
      const absolute = ensureAbsolute(raw);
      const norm = normalizeHref(absolute);
      if (seen.has(norm)) continue;
      seen.add(norm);
      out.push({
        label: (l?.label ?? "").trim() || raw,
        href: absolute,
        _key: norm,
      });
    }
    return out;
  })();

  return (
    <header className="w-full bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-b sticky top-0 z-40">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex flex-col md:flex-row md:items-center md:gap-8">
          <div className="flex items-center gap-4">
            <div className="relative h-28 w-28 md:h-32 md:w-32 rounded-full overflow-hidden border-2">
              {photoUrl ? (
                <Image
                  src={photoUrl}
                  alt={`${name} photo`}
                  fill
                  sizes="128px"
                  className="object-cover"
                />
              ) : (
                <div className="h-full w-full grid place-items-center text-sm text-gray-400">
                  Photo
                </div>
              )}
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold">{name}</h1>
              {title && <p className="text-gray-600">{title}</p>}
              {dedupedLinks.length > 0 && (
                <div className="flex flex-wrap gap-3 mt-2 text-sm">
                  {dedupedLinks.map((l, idx) => (
                    <a
                      key={`${l._key}-${idx}`}
                      href={l.href}
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-4 text-gray-700 hover:text-black"
                    >
                      {l.label}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Always render About box with the string we got */}
          <div className="mt-4 md:mt-0 md:flex-1">
            <div className="rounded-2xl border p-4 md:p-5 bg-white">
              <h2 className="font-medium mb-2">About me</h2>
              <p className="text-sm leading-relaxed text-gray-700 whitespace-pre-line">
                {aboutText}
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
