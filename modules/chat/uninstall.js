module.exports = async function uninstall(ctx) {
  // server-only requires
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require("path");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Client } = require("pg");

  const moduleDir = (ctx && ctx.moduleDir) || path.join(process.cwd(), "modules", "chat");

  // Use provided pg client if available, otherwise create one
  let pg = ctx && ctx.pgClient;
  let createdClient = false;
  if (!pg) {
    const conn = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
    if (!conn) throw new Error("Missing SUPABASE_DB_URL / DATABASE_URL env for running uninstall");
    pg = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
    await pg.connect();
    createdClient = true;
  }

  try {
    await pg.query("BEGIN");
    // drop module tables (idempotent)
    await pg.query(`DROP TABLE IF EXISTS public.chat_messages;`);
    await pg.query("COMMIT");
  } catch (err) {
    try { await pg.query("ROLLBACK"); } catch {}
    if (createdClient) await pg.end().catch(() => {});
    throw err;
  }

  if (createdClient) await pg.end().catch(() => {});

  return { ok: true, dropped: ["chat_messages"] };
};

// Run when executed directly with `node uninstall.js`
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