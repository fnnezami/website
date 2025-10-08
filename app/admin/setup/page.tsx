import { getSupabaseServer } from "@/lib/supabase-ssr";
import SetupForm from "./setup-form";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const supa = getSupabaseServer();

  // Check if any admin exists
  const { data: admins } = await supa.from("profiles").select("id").eq("role", "admin").limit(1);
  const { data: settings } = await supa.from("settings").select("setup_completed").eq("id", 1).maybeSingle();

  const needsSetup = (admins?.length ?? 0) === 0 || !settings?.setup_completed;

  return <SetupForm needsSetup={!!needsSetup} />;
}
