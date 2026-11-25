DROP INDEX IF EXISTS idx_business_payment_qrs_business_enabled;

CREATE TABLE business_payment_qrs_rebuilt (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  name TEXT NOT NULL,
  image TEXT NOT NULL,
  is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  source_image TEXT NOT NULL DEFAULT '',
  crop_selection TEXT NOT NULL DEFAULT '{"x":0,"y":0,"w":1,"h":1}',
  UNIQUE (business_id, name COLLATE NOCASE),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

INSERT INTO business_payment_qrs_rebuilt (
  id, business_id, name, image, is_enabled, created_at, updated_at, source_image, crop_selection
)
SELECT
  id, business_id, name, image, is_enabled, created_at, updated_at, source_image, crop_selection
FROM business_payment_qrs;

DROP TABLE business_payment_qrs;

ALTER TABLE business_payment_qrs_rebuilt RENAME TO business_payment_qrs;

CREATE INDEX idx_business_payment_qrs_business_enabled
ON business_payment_qrs(business_id, is_enabled, created_at);
