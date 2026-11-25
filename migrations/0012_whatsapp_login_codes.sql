CREATE TABLE IF NOT EXISTS whatsapp_login_codes (
  whatsapp TEXT PRIMARY KEY,
  challenge_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  consumed_at INTEGER
);

CREATE TABLE IF NOT EXISTS whatsapp_login_requests (
  id TEXT PRIMARY KEY,
  phone_hash TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_login_requests_phone_created
  ON whatsapp_login_requests(phone_hash, created_at);
CREATE INDEX IF NOT EXISTS idx_whatsapp_login_requests_ip_created
  ON whatsapp_login_requests(ip_hash, created_at);
CREATE INDEX IF NOT EXISTS idx_whatsapp_login_requests_created
  ON whatsapp_login_requests(created_at);
