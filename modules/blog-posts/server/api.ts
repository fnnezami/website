// Self-contained DB helpers and exported API functions for this module.
// These functions are meant to be called by your app-level route handlers
// or imported by dynamic loaders. They do NOT perform auth checks — caller should.
import { Client } from "pg";

function getConnString() {
  return process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || "";
}

async function getPg() {
  const conn = getConnString();
  if (!conn) throw new Error("Missing SUPABASE_DB_URL / DATABASE_URL env");
  const pg = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } as any });
  await pg.connect();
  return pg;
}

// ensure share_settings column exists (idempotent)
async function ensureShareSettings(pg: Client) {
  try {
    await pg.query(`ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS share_settings JSONB DEFAULT '{}'::jsonb;`);
  } catch {
    // ignore - best-effort
  }
}

export type PublicPost = {
  id: number;
  title: string;
  slug: string;
  summary?: string | null;
  content: string;
  published: boolean;
  author_email?: string | null;
  created_at: string;
  updated_at: string;
  share_settings?: Record<string, boolean> | null;
};

// Public: list published posts
export async function listPublishedPosts(): Promise<PublicPost[]> {
  const pg = await getPg();
  try {
    await ensureShareSettings(pg);
    const res = await pg.query(
      `SELECT id, title, slug, summary, content, published, author_email, created_at, updated_at, share_settings
       FROM blog_posts
       WHERE published = true
       ORDER BY created_at DESC`
    );
    return res.rows;
  } finally {
    await pg.end();
  }
}

// Public: get single post by slug
export async function getPostBySlug(slug: string): Promise<PublicPost | null> {
  const pg = await getPg();
  try {
    await ensureShareSettings(pg);
    const res = await pg.query(
      `SELECT id, title, slug, summary, content, published, author_email, created_at, updated_at, share_settings
       FROM blog_posts
       WHERE slug = $1
       LIMIT 1`,
      [slug]
    );
    return res.rows[0] || null;
  } finally {
    await pg.end();
  }
}

// Admin: list all posts (caller must verify admin)
export async function adminListPosts(): Promise<PublicPost[]> {
  const pg = await getPg();
  try {
    // ensure share_settings exists (idempotent)
    await pg.query(`ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS share_settings JSONB DEFAULT '{}'::jsonb;`);
    const res = await pg.query(
      `SELECT id, title, slug, summary, content, published, author_email, created_at, updated_at, share_settings
       FROM blog_posts
       ORDER BY created_at DESC`
    );
    return res.rows;
  } finally {
    await pg.end();
  }
}

// Admin: create a post
export async function adminCreatePost(payload: {
  title: string;
  slug: string;
  summary?: string | null;
  content: string;
  published?: boolean;
  author_email?: string | null;
  share_settings?: Record<string, boolean>;
}) {
  const pg = await getPg();
  try {
    await pg.query(`ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS share_settings JSONB DEFAULT '{}'::jsonb;`);
    const res = await pg.query(
      `INSERT INTO blog_posts (title, slug, summary, content, published, author_email, share_settings)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, created_at, updated_at`,
      [
        payload.title,
        payload.slug,
        payload.summary || null,
        payload.content,
        !!payload.published,
        payload.author_email || null,
        JSON.stringify(payload.share_settings || {}),
      ]
    );
    return res.rows[0];
  } finally {
    await pg.end();
  }
}

// Admin: update a post by id
export async function adminUpdatePost(id: number, payload: {
  title: string;
  slug: string;
  summary?: string | null;
  content: string;
  published?: boolean;
  share_settings?: Record<string, boolean>;
}) {
  const pg = await getPg();
  try {
    await pg.query(`ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS share_settings JSONB DEFAULT '{}'::jsonb;`);
    await pg.query(
      `UPDATE blog_posts SET title=$1, slug=$2, summary=$3, content=$4, published=$5, share_settings=$6, updated_at=now() WHERE id=$7`,
      [
        payload.title,
        payload.slug,
        payload.summary || null,
        payload.content,
        !!payload.published,
        JSON.stringify(payload.share_settings || {}),
        id,
      ]
    );
    return true;
  } finally {
    await pg.end();
  }
}

// Admin: delete a post by id
export async function adminDeletePost(id: number) {
  const pg = await getPg();
  try {
    await pg.query(`DELETE FROM blog_posts WHERE id = $1`, [id]);
    return true;
  } finally {
    await pg.end();
  }
}