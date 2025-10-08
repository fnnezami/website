// app/projects/[slug]/page.tsx
import { notFound } from "next/navigation";
import { fetchNormalizedResume } from "@/lib/gist";
import { createClient } from "@supabase/supabase-js";
import ProjectClientView from "@/components/ProjectClientView";

export const revalidate = 0;
export const dynamic = "force-dynamic";

function toSlug(title: string) {
  return (title || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export default async function ProjectDetail({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>; // ✅ Next 15: params is async
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>; // ✅ also async
}) {
  // Await route params + query params
  const { slug } = await params;
  const sp = await searchParams;

  // Create Supabase client at call-time (server component)
  const supa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
  );

  // 1) Find project in CV
  const resume = await fetchNormalizedResume();
  const list: any[] = Array.isArray((resume as any)?.projects) ? (resume as any).projects : [];
  const cv = list.map((p) => ({ p, slug: toSlug(p?.name || "") })).find((x) => x.slug === slug)?.p;

  if (!cv) return notFound();

  // 2) Merge Admin detail (content, cover, gallery)
  const { data: detail } = await supa
    .from("project_details")
    .select("*")
    .eq("slug", slug)
    .single();

  const title = cv.name || "Project";
  const summary = cv.summary || cv.description || "";
  const cover = (detail?.cover_image || cv.image || cv.coverUrl || "") as string;
  const tags: string[] = Array.isArray(cv.keywords) ? cv.keywords : [];
  const gallery: string[] = Array.isArray(detail?.gallery) ? detail!.gallery : [];
  const content = (detail?.content_md || "") as string;
  const url = (cv.url || "") as string;

  // Preview flag (admin “Preview” opens ?preview=1 and ProjectClientView reads sessionStorage payload)
  const isPreview = String(sp?.preview || "") === "1";

  return (
    <ProjectClientView
      slug={slug}
      title={title}
      summary={summary}
      tags={tags}
      url={url}
      initialCover={cover}
      initialContent={content}
      initialGallery={gallery}
      isPreview={isPreview}
    />
  );
}
