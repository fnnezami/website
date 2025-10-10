-- Create blog_posts table (id uses serial for compatibility)
CREATE TABLE IF NOT EXISTS blog_posts (
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

-- ensure a place for per-post settings (share toggles). ALTER is idempotent.
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS share_settings JSONB DEFAULT '{}'::jsonb;

-- Optional: trigger to update updated_at on row change
CREATE OR REPLACE FUNCTION blog_posts_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_blog_posts_updated_at ON blog_posts;
CREATE TRIGGER trg_blog_posts_updated_at
BEFORE UPDATE ON blog_posts
FOR EACH ROW EXECUTE FUNCTION blog_posts_update_timestamp();