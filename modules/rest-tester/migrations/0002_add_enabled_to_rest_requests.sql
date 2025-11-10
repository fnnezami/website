ALTER TABLE rest_requests
ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_rest_requests_enabled ON rest_requests(enabled);