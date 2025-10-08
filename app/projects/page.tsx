import { fetchNormalizedResume } from "@/lib/gist";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

export const revalidate = 0;
export const dynamic = "force-dynamic";

type CvProject = {
  name?: string;
  summary?: string;
  description?: string;
  url?: string;
  keywords?: string[];
  image?: string;
  coverUrl?: string;
};

function toSlug(title: string) {
  return (title || "")
    .toLowerCase()
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export default async function ProjectsPage() {
  // 1) CV projects (base data)
  const resume = await fetchNormalizedResume();
  const raw: CvProject[] = Array.isArray(resume?.projects) ? resume.projects : [];

  const projects = raw
    .filter((p) => p?.name?.trim())
    .map((p) => ({
      slug: toSlug(p.name!),
      title: p.name!,
      summary: p.summary || p.description || "",
      cover: p.image || p.coverUrl || "",
      url: p.url || "",
      tags: Array.isArray(p.keywords) ? p.keywords.slice(0, 8) : [],
    }));

  // 2) Overlay covers from Supabase project_details (if any)
  try {
    const supa = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
    );
    const { data: details } = await supa
      .from("project_details")
      .select("slug, cover_image");

    if (Array.isArray(details) && details.length) {
      const coverMap = new Map(details.map((d) => [d.slug, d.cover_image as string | null]));
      for (const p of projects) {
        const cover = coverMap.get(p.slug);
        if (cover) p.cover = cover; // prefer admin cover if present
      }
    }
  } catch {
    // ignore if envs missing; keep CV covers
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Projects</h2>

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {projects.map((p) => (
          <div
            key={p.slug}
            className="group rounded-2xl border overflow-hidden bg-white hover:shadow-md transition-shadow"
          >
            {p.cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.cover} alt={p.title} className="h-40 w-full object-cover" />
            ) : (
              <div className="h-40 w-full bg-neutral-100" />
            )}

            <div className="p-4">
              {/* Title links to internal detail page */}
              <Link
                href={`/projects/${p.slug}`}
                className="font-medium group-hover:underline underline-offset-4"
              >
                {p.title}
              </Link>

              {p.summary && (
                <p className="text-sm text-gray-600 mt-1 line-clamp-3">{p.summary}</p>
              )}

              {p.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {p.tags.map((t) => (
                    <span
                      key={t}
                      className="text-xs px-2 py-1 bg-neutral-50 border rounded-full"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="mt-3 flex items-center gap-2">
                <Link
                  href={`/projects/${p.slug}`}
                  className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-50"
                >
                  Details
                </Link>
                {p.url && (
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center rounded-md bg-black px-3 py-1.5 text-sm text-white hover:opacity-90"
                  >
                    Visit project
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}

        {projects.length === 0 && (
          <div className="rounded-2xl border bg-white p-6 text-sm text-gray-600">
            No projects in your CV yet.
          </div>
        )}
      </div>
    </div>
  );
}
