import { getSupabaseServer } from "./supabase-ssr";

export async function getSession() {
  const supa = getSupabaseServer();
  const { data } = await supa.auth.getSession();
  return data.session; // null if logged out
}

export async function getUser() {
  const supa = getSupabaseServer();
  const { data } = await supa.auth.getUser();
  return data.user; // null if logged out
}
