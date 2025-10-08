import { notFound } from "next/navigation";
import { getPageModuleBySlug } from "@/lib/modules";
import PageRenderer from "@/components/PageRenderer";

export const revalidate = 0;
export const dynamic = "force-dynamic";

export default async function ModulePage({ params }: { params: { slug: string } }) {
  const mod = await getPageModuleBySlug(params.slug);
  if (!mod) return notFound();

  // Convention: page module puts its UI tree in config.layout
  const layout = mod?.config?.layout || { sections: [] };

  return (
    <div className="space-y-6">
      {mod.title ? <h1 className="text-2xl font-semibold">{mod.title}</h1> : null}
      <PageRenderer layout={layout} />
    </div>
  );
}
