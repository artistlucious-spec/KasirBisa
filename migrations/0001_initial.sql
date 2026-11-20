-- Migrasi pertama: membuat tabel katalog dan transaksi untuk satu ruang data.
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  barcode TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price INTEGER NOT NULL CHECK (price > 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  image TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  waktu TEXT NOT NULL,
  subtotal INTEGER NOT NULL,
  diskon INTEGER NOT NULL,
  ppn INTEGER NOT NULL,
  total INTEGER NOT NULL,
  dibayar INTEGER NOT NULL,
  kembalian INTEGER NOT NULL,
  member INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS transaction_items (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL,
  product_code TEXT NOT NULL,
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0),
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_transactions_waktu ON transactions(waktu);
CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction ON transaction_items(transaction_id);
