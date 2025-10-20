import { createClient } from "./supabase-ssr";

export async function getSession() {
  const supa = createClient();
  const { data } = await (await supa).auth.getSession();
  return data.session; // null if logged out
}

export async function getUser() {
  const supa = createClient();
  const { data } = await (await supa).auth.getUser();
  return data.user; // null if logged out
}
