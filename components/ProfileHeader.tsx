"use client";

import Image from "next/image";

type Props = {
  name: string;
  title?: string;
  about?: string; // ← we now always pass basics.summary here
  photoUrl?: string;
  links?: { label: string; href: string }[];
};

function normalizeHref(href: string) {
  return href.trim().toLowerCase().replace(/\/+$/, "");
}

export default function ProfileHeader({
  name,
  title,
  about,
  photoUrl,
  links = [],
}: Props) {
  // Dedupe by normalized URL; keep original order and the first occurrence
  const dedupedLinks = (() => {
    const seen = new Set<string>();
    const out: { label: string; href: string; _key: string }[] = [];
    for (const l of links) {
      const href = (l?.href ?? "").trim();
      if (!href) continue;
      const norm = normalizeHref(href);
      if (seen.has(norm)) continue;
      seen.add(norm);
      out.push({
        label: (l?.label ?? "").trim() || href,
        href,
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

          {/* Always render the About box; show whatever string we got */}
          <div className="mt-4 md:mt-0 md:flex-1">
            <div className="rounded-2xl border p-4 md:p-5 bg-white">
              <h2 className="font-medium mb-2">About me</h2>
              <p className="text-sm leading-relaxed text-gray-700 whitespace-pre-line">
                {about ?? ""} {/* if empty string, it will render empty space */}
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
