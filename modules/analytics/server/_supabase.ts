import { createClient } from "@supabase/supabase-js";

export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export function parseRange(range: string | null | undefined) {
  const r = (range || "7d").toLowerCase();
  if (r === "24h" || r === "1d") return { sinceSQL: "1 day" as const, bucket: "hour" as const };
  if (r === "30d") return { sinceSQL: "30 days" as const, bucket: "day" as const };
  if (r === "90d") return { sinceSQL: "90 days" as const, bucket: "day" as const };
  return { sinceSQL: "7 days" as const, bucket: "day" as const };
}