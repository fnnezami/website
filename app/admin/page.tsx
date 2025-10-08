// /app/admin/page.tsx
import Link from "next/link";
import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AdminHome() {
  const SUPA_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const SUPA_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const SERVICE   = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!SUPA_URL || !SUPA_ANON) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Setup required</h1>
        <p className="text-sm text-gray-600">Missing Supabase envs.</p>
        <Link href="/setup/install" className="underline underline-offset-4 text-sm">Open setup</Link>
      </div>
    );
  }

  // 1) Server-authenticated user
  const jar = await cookies();
  const anon = createServerClient(SUPA_URL, SUPA_ANON, {
    cookies: { get: (n) => jar.get(n)?.value, set(){}, remove(){} },
  });

  const { data: { user } } = await anon.auth.getUser();
  const email = user?.email?.toLowerCase() || null;

  if (!email) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center space-y-3">
        <h1 className="text-xl font-semibold">Not signed in</h1>
        <p className="text-sm text-gray-600">The server does not see a session yet.</p>
        <Link href="/login?next=/admin" className="underline underline-offset-4 text-sm">Go to login</Link>
      </div>
    );
  }

  // 2) Read allowlist with service role
  let allowed = true;
  if (SERVICE) {
    const srv = createClient(SUPA_URL, SERVICE);
    const { data: settings, error } = await srv
      .from("settings")
      .select("admin_allowlist")
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      return (
        <div className="mx-auto max-w-md px-4 py-16 text-center space-y-3">
          <h1 className="text-xl font-semibold">Settings error</h1>
          <p className="text-sm text-red-600">{error.message}</p>
          <Link href="/setup/install" className="underline underline-offset-4 text-sm">Re-run setup</Link>
        </div>
      );
    }

    let allow: string[] = Array.isArray(settings?.admin_allowlist)
      ? settings!.admin_allowlist.map((e: string) => (e || "").toLowerCase())
      : [];

    // 3) If empty, call our API once to bootstrap the owner, then re-read
    if (allow.length === 0) {
      const h = await headers();
      const cookieHeader = h.get("cookie") || "";
      const proto = h.get("x-forwarded-proto") || "http";
      const host  = h.get("x-forwarded-host")  || h.get("host") || "localhost:3000";
      const origin = `${proto}://${host}`;

      await fetch(`${origin}/api/admin/bootstrap-owner`, {
        method: "POST",
        headers: { cookie: cookieHeader },
        cache: "no-store",
      }).catch(() => {});

      const again = await srv
        .from("settings")
        .select("admin_allowlist")
        .eq("id", 1)
        .maybeSingle();

      allow = Array.isArray(again.data?.admin_allowlist)
        ? again.data!.admin_allowlist.map((e: string) => (e || "").toLowerCase())
        : [];
    }

    allowed = allow.includes(email);
  }

  if (!allowed) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Access denied</h1>
        <p className="text-sm text-gray-600">This admin panel is restricted to the site owner.</p>
        <form action="/logout" method="post" className="inline-block">
          <button className="mt-3 rounded-md bg-black text-white px-4 py-2">Logout</button>
        </form>
      </div>
    );
  }

  // --- Admin UI (unchanged) ---
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold">Admin</h1>
          <p className="text-sm text-gray-600">Manage your site content and integrations.</p>
        </div>
        <form action="/logout" method="post">
          <button className="rounded-md bg-black text-white px-3 py-1.5 text-sm">Logout</button>
        </form>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/admin/projects" className="rounded-2xl border bg-white p-5 hover:shadow-md transition-shadow block">
          <div className="text-lg font-medium">Projects</div>
          <p className="text-sm text-gray-600 mt-1">Create, edit, and publish project details and galleries.</p>
          <span className="inline-block mt-3 text-sm underline underline-offset-4">Open Projects</span>
        </Link>

        <div className="rounded-2xl border bg-white p-5 opacity-80">
          <div className="text-lg font-medium">Publications (soon)</div>
          <p className="text-sm text-gray-600 mt-1">Configure enrichment, curate highlights, and tweak display.</p>
          <span className="inline-block mt-3 text-sm text-gray-500">Coming soon</span>
        </div>

        <div className="rounded-2xl border bg-white p-5 opacity-80">
          <div className="text-lg font-medium">Settings (soon)</div>
          <p className="text-sm text-gray-600 mt-1">Site theme, header links, API keys, and integrations.</p>
          <span className="inline-block mt-3 text-sm text-gray-500">Coming soon</span>
        </div>
      </div>

      <section className="rounded-2xl border bg-white p-5">
        <h2 className="text-lg font-medium">Notes</h2>
        <ul className="list-disc pl-5 text-sm mt-2 space-y-1 text-gray-700">
          <li>Projects load from your CV for listing; details come from Admin.</li>
          <li>Publications enrich via DOI (Crossref/OpenAlex).</li>
          <li>You can add more panels here without changing the page structure.</li>
        </ul>
      </section>
    </div>
  );
}
