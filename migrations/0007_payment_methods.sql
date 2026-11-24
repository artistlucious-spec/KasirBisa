ALTER TABLE transactions
ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'tunai'
CHECK (payment_method IN ('tunai', 'qris'));

CREATE TABLE business_payment_settings (
  business_id TEXT PRIMARY KEY,
  qris_enabled INTEGER NOT NULL DEFAULT 0 CHECK (qris_enabled IN (0, 1)),
  qris_image TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);
