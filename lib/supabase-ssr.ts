import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export function getSupabaseServer() {
  const cookieStore = cookies(); // Next 14/15
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
      },
    }
  );
}
