// ...new file...
module.exports = async function install(ctx) {
  // server-side: use ctx.pgClient if provided, else create a simple client
  const pg = ctx?.pgClient;
  if (!pg) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Client } = require("pg");
    const conn = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
    if (!conn) throw new Error("Missing DATABASE_URL / SUPABASE_DB_URL");
    const client = new Client({ connectionString: conn });
    await client.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS chat_messages (
          id SERIAL PRIMARY KEY,
          user_id TEXT,
          message TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
        );
      `);
    } finally {
      await client.end().catch(()=>{});
    }
    return { ok: true, note: "chat tables created (standalone)" };
  }

  // If pg client passed via ctx, use it
  await pg.query(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id SERIAL PRIMARY KEY,
      user_id TEXT,
      message TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    );
  `);
  return { ok: true, note: "chat tables created" };
};
// ...new file...