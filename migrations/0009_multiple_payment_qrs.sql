ALTER TABLE transactions
ADD COLUMN payment_label TEXT NOT NULL DEFAULT '';

UPDATE transactions
SET payment_label = CASE
  WHEN payment_method = 'qris' THEN 'QRIS'
  ELSE 'Tunai'
END;

CREATE TABLE business_payment_qrs (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  name TEXT NOT NULL,
  image TEXT NOT NULL,
  is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (business_id, name COLLATE NOCASE),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE INDEX idx_business_payment_qrs_business_enabled
ON business_payment_qrs(business_id, is_enabled, created_at);

INSERT INTO business_payment_qrs (
  id, business_id, name, image, is_enabled, created_at, updated_at
)
SELECT
  'legacy-' || business_id,
  business_id,
  'QRIS',
  qris_image,
  qris_enabled,
  COALESCE(updated_at, CURRENT_TIMESTAMP),
  COALESCE(updated_at, CURRENT_TIMESTAMP)
FROM business_payment_settings
WHERE qris_image <> '';
