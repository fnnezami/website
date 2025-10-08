import { createClient } from "@supabase/supabase-js";

// Anonymous client is enough for reading enabled modules
const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function getEnabledFloatingModules() {
  const { data, error } = await supa
    .from("modules")
    .select("*")
    .eq("kind", "floating")
    .eq("enabled", true)
    .order("id");
  if (error) return [];
  return data || [];
}

export async function getPageModuleBySlug(slug: string) {
  const { data, error } = await supa
    .from("modules")
    .select("*")
    .eq("kind", "page")
    .eq("slug", slug)
    .eq("enabled", true)
    .maybeSingle();
  if (error) return null;
  return data;
}
