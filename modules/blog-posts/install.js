// Module installer for blog-posts.
// Exports async function(ctx) used by canonical installer.
// ctx: { moduleDir, manifest, pgClient, supabaseService }
module.exports = async function install(ctx) {
  // server-only requires
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require("fs");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require("path");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Client } = require("pg");

  // IMPORTANT: resolve moduleDir from ctx if provided, otherwise use this file's directory.
  // Using process.cwd() can be wrong when the installer is spawned with cwd set to the module folder.
  const moduleDir = (ctx && ctx.moduleDir) || __dirname;

  // Use provided pg client if available, otherwise create one
  let pg = ctx && ctx.pgClient;
  let createdClient = false;
  if (!pg) {
    const conn = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
    if (!conn) throw new Error("Missing SUPABASE_DB_URL / DATABASE_URL env for running migrations");
    pg = new Client({ connectionString: conn });
    await pg.connect();
    createdClient = true;
  }

  // load manifest (if not provided)
  let manifest = ctx && ctx.manifest;
  try {
    const mpath = path.join(moduleDir, "manifest.json");
    if (!manifest && fs.existsSync(mpath)) {
      manifest = JSON.parse(fs.readFileSync(mpath, "utf8"));
    }
  } catch (e) {
    // ignore and continue; migrations may still be in folder
  }

  const migrations = Array.isArray(manifest?.migrations) ? manifest.migrations : [];
  const applied = [];

  try {
    if (migrations.length > 0) {
      // run migrations transactionally
      await pg.query("BEGIN");
      for (const mig of migrations) {
        const migPath = path.join(moduleDir, mig);
        if (!fs.existsSync(migPath)) {
          throw new Error("Migration file not found: " + migPath);
        }
        const sql = fs.readFileSync(migPath, "utf8");
        await pg.query(sql);
        applied.push({ migration: mig, ok: true });
      }
      await pg.query("COMMIT");
    } else {
      // No migrations declared -> no-op (or fallback behavior)
      // keep idempotent default: create blog_posts if missing (safe)
      const defaultSql = `
        CREATE TABLE IF NOT EXISTS public.blog_posts (
          id SERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          slug TEXT UNIQUE NOT NULL,
          summary TEXT,
          content TEXT NOT NULL,
          published BOOLEAN DEFAULT FALSE,
          author_email TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
        );
      `;
      await pg.query(defaultSql);
      applied.push({ migration: "(default blog-posts setup)", ok: true });
    }
  } catch (err) {
    try { await pg.query("ROLLBACK"); } catch {}
    if (createdClient) await pg.end().catch(() => {});
    throw err;
  }

  if (createdClient) await pg.end().catch(() => {});

  return { ok: true, applied };
};

// Run when executed directly with `node install.js`
// prints JSON on success so the installer process can capture it
if (require.main === module) {
  (async () => {
    try {
      const res = await module.exports({});
      // eslint-disable-next-line no-console
      console.log(JSON.stringify({ ok: true, result: res }, null, 2));
      process.exit(0);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(String(err?.stack || err?.message || err));
      process.exit(1);
    }
  })();
}