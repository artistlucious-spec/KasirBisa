# Database

Kasir Bisa Web menggunakan Cloudflare D1 melalui binding `DB`. Konfigurasi database berada di `wrangler.toml`; nama database yang tercantum di konfigurasi adalah `kasir-bisa`.

## Migrasi

- `0001_initial.sql`: tabel katalog dan transaksi beserta indeks waktu transaksi.
- `0002_seed_products.sql`: data awal produk contoh.
- `0003_owner_profile.sql`: profil pemilik tunggal untuk login dan pengaturan akun.

Jalankan `npm run d1:migrate:local` untuk D1 lokal. Jalankan `npm run d1:migrate:remote` hanya setelah memastikan akun Cloudflare dan database remote yang dikonfigurasi adalah milik website ini. Jangan menjalankan migrasi terhadap database lain.

## Tabel

### `products`

Menyimpan `id`, kode produk, barcode unik, nama, kategori, harga, stok, dan gambar. Harga harus positif; stok tidak boleh negatif. Gambar disimpan sebagai data URL WebP setelah kompresi, atau sebagai path aset untuk produk contoh awal.

### `transactions`

Menyimpan ID transaksi, waktu, subtotal, diskon, PPN, total, uang dibayar, kembalian, dan status member.

### `transaction_items`

Menyimpan rincian item per transaksi: kode produk, nama dan harga saat transaksi, serta kuantitas. Relasi `transaction_id` mengarah ke `transactions`.

### `owner_profile`

Tabel singleton dengan `id = 1`, username, hash dan salt password, jumlah iterasi PBKDF2, foto profil, versi sesi, serta waktu pembaruan. Data password plaintext tidak disimpan.

## Formula transaksi

- Member mendapat diskon 10% dari subtotal.
- Non-member mendapat diskon 5% jika subtotal minimal Rp100.000.
- PPN 11% dihitung dari subtotal setelah diskon.
- Stok berkurang setelah transaksi tervalidasi dan tersimpan.

Angka transaksi dan data stok di server dihitung kembali dari data D1, bukan dipercaya dari total yang dihitung hanya di browser.
