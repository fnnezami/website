-- Ensure UUID function exists
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create table for saved REST requests
CREATE TABLE IF NOT EXISTS rest_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  url TEXT NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS')),
  params JSONB DEFAULT '{}',
  headers JSONB DEFAULT '{}',
  body JSONB DEFAULT '{}',
  auth_type TEXT CHECK (auth_type IN ('none', 'bearer', 'basic', 'apikey', 'custom')),
  auth_config JSONB DEFAULT '{}',
  field_types JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster name searches
CREATE INDEX IF NOT EXISTS idx_rest_requests_name ON rest_requests(name);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_rest_requests_updated_at
  BEFORE UPDATE ON rest_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();