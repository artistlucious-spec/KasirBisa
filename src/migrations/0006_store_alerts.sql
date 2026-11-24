-- Pusat Perhatian Toko: notifikasi dan saran yang terisolasi per usaha.
-- Satu isu aktif per alert_key dan business_id; isu yang sudah selesai
-- atau ditandai tidak relevan dapat muncul kembali sebagai notifikasi baru.
CREATE TABLE IF NOT EXISTS store_alerts (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  alert_key TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'stok',
    'penjualan',
    'produk',
    'peluang',
    'aktivitas'
  )),
  priority TEXT NOT NULL DEFAULT 'info' CHECK (priority IN (
    'tinggi',
    'sedang',
    'info'
  )),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  evidence_json TEXT NOT NULL DEFAULT '{}',
  action_label TEXT,
  action_type TEXT,
  action_payload_json TEXT,
  status TEXT NOT NULL DEFAULT 'baru' CHECK (status IN (
    'baru',
    'dibaca',
    'ditangani',
    'selesai',
    'tidak_relevan'
  )),
  first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at TEXT,
  resolved_at TEXT,
  expires_at TEXT,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  CHECK (length(trim(alert_key)) > 0),
  CHECK (length(trim(title)) > 0),
  CHECK (length(trim(message)) > 0)
);

-- Hanya satu notifikasi aktif untuk isu yang sama dalam satu usaha.
-- Status selesai/tidak relevan tidak menghalangi isu serupa muncul lagi.
CREATE UNIQUE INDEX IF NOT EXISTS idx_store_alerts_active_key
ON store_alerts (business_id, alert_key)
WHERE status IN ('baru', 'dibaca', 'ditangani');

-- Membantu mengambil badge notifikasi baru per usaha.
CREATE INDEX IF NOT EXISTS idx_store_alerts_business_unread
ON store_alerts (business_id, created_at DESC)
WHERE status = 'baru';

-- Membantu menampilkan daftar notifikasi per usaha dan status.
CREATE INDEX IF NOT EXISTS idx_store_alerts_business_status_updated
ON store_alerts (business_id, status, updated_at DESC);
