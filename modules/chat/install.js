// Simple server-side installer for the chat module.
// Runs during POST /api/admin/modules/install and ensures chat DB table exists.
module.exports = async function install(ctx) {
  // ctx.pgClient may be provided by the installer; fall back to creating a client if not.
  const pgClient = ctx?.pgClient;
  if (pgClient) {
    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        user_id TEXT,
        message TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);
    return { ok: true, note: "chat tables created (using provided pgClient)" };
  }

  // standalone: create a temporary PG client
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
    return { ok: true, note: "chat tables created (standalone)" };
  } finally {
    await client.end().catch(()=>{});
  }
};