"use client";
import { useMemo, useState } from "react";

export default function InstallSetupPage() {
  const [supabaseUrl, setSupabaseUrl] = useState("");
  const [anonKey, setAnonKey] = useState("");
  const [serviceKey, setServiceKey] = useState("");
  const [dbUrl, setDbUrl] = useState("");
  const [adminEmail, setAdminEmail] = useState("");

  // NEW: gist pieces
  const [gistUser, setGistUser] = useState("");
  const [gistId, setGistId] = useState("");

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [envBlock, setEnvBlock] = useState<string | null>(null);

  // We’ll always write resume.json as the filename.
  const gistRawUrl = useMemo(() => {
    const u = gistUser.trim();
    const g = gistId.trim();
    if (!u || !g) return "";
    // Works without pinning a specific commit SHA:
    return `https://gist.githubusercontent.com/${u}/${g}/raw/resume.json`;
  }, [gistUser, gistId]);

  async function onProvision(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null); setErr(null); setEnvBlock(null);

    try {
      // 1) provision DB + bucket + allowlist (this route doesn’t need the Gist)
      const provisionRes = await fetch("/api/setup/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          NEXT_PUBLIC_SUPABASE_URL: supabaseUrl.trim(),
          NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey.trim(),
          SUPABASE_SERVICE_ROLE_KEY: serviceKey.trim(),
          DATABASE_URL: dbUrl.trim(),
          ADMIN_ALLOWLIST: adminEmail.trim() ? [adminEmail.trim().toLowerCase()] : [],
        }),
      });
      const provisionTxt = await provisionRes.text();
      let pjson: any;
      try { pjson = JSON.parse(provisionTxt); } catch { throw new Error(`Provision returned non-JSON (status ${provisionRes.status}).`); }
      if (!provisionRes.ok || pjson?.ok === false) throw new Error(pjson?.error || `Provision failed (${provisionRes.status})`);

      // 2) write .env.local (or show copy block) — include GIST_RAW_URL
      const envRes = await fetch("/api/setup/write-env", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          NEXT_PUBLIC_SUPABASE_URL: supabaseUrl.trim(),
          NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey.trim(),
          SUPABASE_SERVICE_ROLE_KEY: serviceKey.trim(),
          DATABASE_URL: dbUrl.trim(),
          GIST_RAW_URL: gistRawUrl.trim(),
        }),
      });
      const envTxt = await envRes.text();
      let envJ: any; try { envJ = JSON.parse(envTxt); } catch { envJ = { ok:false, error: envTxt.slice(0,200) }; }

      if (envJ?.ok) {
        setMsg("✅ Setup complete. Enable an OAuth provider in Supabase (once), then go to /login. Restart the dev server so envs load.");
      } else {
        const block =
`NEXT_PUBLIC_SUPABASE_URL=${supabaseUrl.trim()}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${anonKey.trim()}
SUPABASE_SERVICE_ROLE_KEY=${serviceKey.trim()}
DATABASE_URL=${dbUrl.trim()}
GIST_RAW_URL=${gistRawUrl.trim()}`;
        setEnvBlock(block);
        setMsg("✅ Provisioned. Couldn’t write .env.local (likely cloud). Copy these into your hosting environment variables.");
        // after env writing succeeds/fails and setMsg(...)

      }
      const params = new URLSearchParams(window.location.search);
      const next = params.get("next") || "/";
      setTimeout(() => {
        window.location.href = next;
      }, 600);
    } catch (e: any) {
      setErr(e?.message || "Setup failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-6">
      <h1 className="text-xl font-semibold">Initial Setup</h1>
      <p className="text-sm text-gray-600">
        Enter your Supabase credentials and Gist details. This will create tables/policies, a public
        <code> projects</code> bucket, and save your env vars (including <code>GIST_RAW_URL</code>).
      </p>

      {err && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>}
      {msg && <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">{msg}</div>}

      <form className="space-y-4" onSubmit={onProvision}>
        <label className="block">
          <span className="text-sm">NEXT_PUBLIC_SUPABASE_URL</span>
          <input className="w-full border rounded-md p-2" placeholder="https://xxxx.supabase.co" value={supabaseUrl} onChange={e=>setSupabaseUrl(e.target.value)} required />
        </label>

        <label className="block">
          <span className="text-sm">NEXT_PUBLIC_SUPABASE_ANON_KEY</span>
          <input className="w-full border rounded-md p-2" placeholder="eyJhbGciOi..." value={anonKey} onChange={e=>setAnonKey(e.target.value)} required />
        </label>

        <label className="block">
          <span className="text-sm">SUPABASE_SERVICE_ROLE_KEY</span>
          <input className="w-full border rounded-md p-2" placeholder="service role (server-only)" value={serviceKey} onChange={e=>setServiceKey(e.target.value)} required />
        </label>

        <label className="block">
          <span className="text-sm">DATABASE_URL</span>
          <input className="w-full border rounded-md p-2" placeholder="postgresql://postgres:YOUR-PASSWORD@HOST:PORT/postgres" value={dbUrl} onChange={e=>setDbUrl(e.target.value)} required />
        </label>

        {/* NEW: Gist fields */}
        <div className="rounded-md border p-3">
          <div className="font-medium text-sm mb-2">Gist details</div>
          <label className="block mb-2">
            <span className="text-sm">Gist username</span>
            <input className="w-full border rounded-md p-2" placeholder="your-github-username" value={gistUser} onChange={e=>setGistUser(e.target.value)} required />
          </label>
          <label className="block">
            <span className="text-sm">Gist ID</span>
            <input className="w-full border rounded-md p-2" placeholder="62647ff203fe219b526c3eaae9a0f719" value={gistId} onChange={e=>setGistId(e.target.value)} required />
          </label>
          <p className="text-xs text-gray-600 mt-2">
            We will use <code>resume.json</code> as the filename and construct:
          </p>
          <code className="block text-xs mt-1 break-all">
            {gistRawUrl || "https://gist.githubusercontent.com/&lt;user&gt;/&lt;gist-id&gt;/raw/resume.json"}
          </code>
        </div>

        <button disabled={busy} className="rounded-md bg-black text-white px-4 py-2 disabled:opacity-50">
          {busy ? "Provisioning…" : "Provision"}
        </button>
      </form>

      {envBlock && (
        <div className="mt-4">
          <p className="text-sm text-gray-700 mb-2">Copy these into your hosting provider’s environment variables:</p>
          <pre className="rounded-md bg-neutral-900 text-neutral-100 p-3 text-xs overflow-auto">{envBlock}</pre>
        </div>
      )}
    </div>
  );
}
