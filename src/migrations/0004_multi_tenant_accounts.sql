-- Migrasi akun tunggal menjadi beberapa usaha tanpa memindahkan data lama keluar.
-- Buat akun legacy, salin profil, lalu bangun ulang tabel data dengan business_id.
CREATE TABLE businesses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO businesses (id, name)
VALUES ('legacy-business', 'Usaha Saya');

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  username TEXT NOT NULL COLLATE NOCASE UNIQUE,
  whatsapp TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_iterations INTEGER NOT NULL,
  profile_image TEXT NOT NULL DEFAULT '',
  session_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (business_id) REFERENCES businesses(id)
);

INSERT INTO users (
  id, business_id, username, password_hash, password_salt,
  password_iterations, profile_image, session_version, updated_at
)
SELECT
  'legacy-owner', 'legacy-business', username, password_hash, password_salt,
  password_iterations, profile_image, session_version, updated_at
FROM owner_profile
WHERE id = 1;

CREATE UNIQUE INDEX idx_users_whatsapp
ON users(whatsapp)
WHERE whatsapp <> '';

CREATE TABLE products_new (
  id TEXT NOT NULL,
  business_id TEXT NOT NULL,
  code TEXT NOT NULL,
  barcode TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price INTEGER NOT NULL CHECK (price > 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  image TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (business_id, id),
  UNIQUE (business_id, code),
  UNIQUE (business_id, barcode),
  FOREIGN KEY (business_id) REFERENCES businesses(id)
);

INSERT INTO products_new (
  id, business_id, code, barcode, name, category, price, stock, image
)
SELECT id, 'legacy-business', code, barcode, name, category, price, stock, image
FROM products;

DROP TABLE products;
ALTER TABLE products_new RENAME TO products;

CREATE TABLE transactions_new (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  waktu TEXT NOT NULL,
  subtotal INTEGER NOT NULL,
  diskon INTEGER NOT NULL,
  ppn INTEGER NOT NULL,
  total INTEGER NOT NULL,
  dibayar INTEGER NOT NULL,
  kembalian INTEGER NOT NULL,
  member INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (business_id) REFERENCES businesses(id)
);

INSERT INTO transactions_new (
  id, business_id, waktu, subtotal, diskon, ppn, total, dibayar, kembalian, member
)
SELECT
  id, 'legacy-business', waktu, subtotal, diskon, ppn, total, dibayar, kembalian, member
FROM transactions;

CREATE TABLE transaction_items_new (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL,
  product_code TEXT NOT NULL,
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0),
  FOREIGN KEY (transaction_id) REFERENCES transactions_new(id) ON DELETE CASCADE
);

INSERT INTO transaction_items_new (id, transaction_id, product_code, name, price, qty)
SELECT id, transaction_id, product_code, name, price, qty
FROM transaction_items;

DROP TABLE transaction_items;
DROP TABLE transactions;
ALTER TABLE transactions_new RENAME TO transactions;
ALTER TABLE transaction_items_new RENAME TO transaction_items;
DROP TABLE owner_profile;

CREATE INDEX idx_transactions_waktu ON transactions(waktu);
CREATE INDEX idx_transactions_business_waktu ON transactions(business_id, waktu);
CREATE INDEX idx_transaction_items_transaction ON transaction_items(transaction_id);
