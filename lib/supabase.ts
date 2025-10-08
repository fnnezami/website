// /lib/supabase.ts
"use client";
import { createClient } from "@supabase/supabase-js";

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabaseBrowser = createClient(url, anon, {
  auth: {
    persistSession: true, // required for client-side session cache
    autoRefreshToken: true,
    flowType: "pkce",     // recommended for OAuth
  },
});
