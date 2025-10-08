// lib/env-client.ts
// Only expose PUBLIC vars to the client.
export const envClient = {
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
};

// Convenience flags
export const isClientEnvReady =
  !!envClient.SUPABASE_URL && !!envClient.SUPABASE_ANON_KEY;
