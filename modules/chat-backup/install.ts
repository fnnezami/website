// runs inside Node during /api/admin/modules/install
export default async function install(ctx: {
  moduleDir: string;
  manifest: any;
  pgClient: any;
  supabaseService: any;
}) {
  const { pgClient } = ctx;
  // example migration done by module itself
  await pgClient.query(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id SERIAL PRIMARY KEY,
      user_id TEXT,
      message TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    );
  `);
  return { ok: true, note: "chat tables created" };
}