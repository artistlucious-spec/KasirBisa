# Database

Kasir Bisa Web menggunakan Cloudflare D1 melalui binding `DB`. Konfigurasi database berada di `wrangler.toml`; nama database yang tercantum di konfigurasi adalah `kasirbisa`.

## Migrasi

- `0001_initial.sql`: tabel katalog dan transaksi beserta indeks waktu transaksi.
- `0002_seed_products.sql`: data awal produk contoh.
- `0003_owner_profile.sql`: profil pemilik tunggal untuk login dan pengaturan akun.
- `0004_multi_tenant_accounts.sql`: akun dan usaha, pemisahan data per usaha, serta pemindahan akun/data lama.
- `0005_password_encrypted.sql`: menambahkan kolom password terenkripsi untuk tampilan password pada profil.

Jalankan `npm run d1:migrate:local` untuk D1 lokal. Setelah menerapkan `0005_password_encrypted.sql`, pengguna lama harus login kembali agar aplikasi dapat membuat salinan password terenkripsi dari password yang baru diverifikasi. Jalankan `npm run d1:migrate:remote` hanya setelah memastikan akun Cloudflare dan database remote yang dikonfigurasi adalah milik project Pages `kasirbisa`. Jangan menjalankan migrasi remote tanpa memeriksa target database.

## Tabel

### `businesses`

Menyimpan identitas dan nama usaha. Akun baru mendapat usaha tersendiri; usaha lama diberi ID `legacy-business`.

### `users`

Menyimpan `business_id`, username unik, nomor WhatsApp, hash dan salt password, foto profil, versi sesi, serta waktu pembaruan. Password plaintext tidak disimpan. WhatsApp dinormalisasi menjadi digit dan unik jika terisi.

### `products`

Menyimpan `business_id`, kode, barcode, nama, kategori, harga, stok, dan gambar. Kode dan barcode unik di dalam satu usaha. Harga harus positif; stok tidak boleh negatif. Gambar disimpan sebagai data URL WebP setelah kompresi, atau sebagai path aset untuk produk contoh awal.

### `transactions`

Menyimpan ID transaksi, `business_id`, waktu, subtotal, diskon, PPN, total, uang dibayar, kembalian, dan status member.

### `transaction_items`

Menyimpan rincian item per transaksi: kode produk, nama dan harga saat transaksi, serta kuantitas. Relasi `transaction_id` mengarah ke `transactions`.

## Formula transaksi

- Member mendapat diskon 10% dari subtotal.
- Non-member mendapat diskon 5% jika subtotal minimal Rp100.000.
- PPN 11% dihitung dari subtotal setelah diskon.
- Stok berkurang setelah transaksi tervalidasi dan tersimpan.

Angka transaksi dan data stok di server dihitung kembali dari data D1, bukan dipercaya dari total yang dihitung hanya di browser.
