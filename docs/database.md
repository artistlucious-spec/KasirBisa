# Database

Kasir Bisa Web menggunakan Cloudflare D1 melalui binding `DB`. Konfigurasi database berada di `wrangler.toml`; nama database yang tercantum di konfigurasi adalah `kasirbisa`.

## Migrasi

- `0001_initial.sql`: tabel katalog dan transaksi beserta indeks waktu transaksi.
- `0002_seed_products.sql`: data awal produk contoh.
- `0003_owner_profile.sql`: profil pemilik tunggal untuk login dan pengaturan akun.
- `0004_multi_tenant_accounts.sql`: akun dan usaha, pemisahan data per usaha, serta pemindahan akun/data lama.
- `0005_password_encrypted.sql`: menambahkan kolom password terenkripsi untuk tampilan password pada profil.
- `0006_store_alerts.sql`: menambahkan penyimpanan Pusat Perhatian Toko dengan status, prioritas, bukti analisis, dan pencegahan duplikasi notifikasi aktif per usaha.
- `0007_payment_methods.sql`: mencatat metode pembayaran pada transaksi dan menyimpan gambar serta status QRIS per usaha.
- `0008_admin_accounts.sql`: menambahkan status aktif/nonaktif akun untuk pengelolaan akses admin.
- `0009_multiple_payment_qrs.sql`: menambahkan daftar hingga 10 QRIS bernama per usaha, memindahkan gambar QRIS lama, dan menyimpan label QR yang dipakai pada transaksi.

Jalankan `npm run d1:migrate:local` untuk D1 lokal. Database Cloudflare remote tidak membuat tabel secara otomatis ketika kode di-deploy; migrasi perlu diterapkan secara terpisah. Untuk target pada `wrangler.toml`, periksa dahulu nama dan ID database, lalu jalankan `npx wrangler d1 migrations apply kasirbisa --remote` dari folder project ini (atau `npm run d1:migrate:remote`). Jangan jalankan perintah remote sebelum memastikan akun Cloudflare dan database yang dituju adalah target yang benar. Setelah menerapkan `0005_password_encrypted.sql`, pengguna lama harus login kembali agar aplikasi dapat membuat salinan password terenkripsi dari password yang baru diverifikasi.

## Tabel

### `businesses`

Menyimpan identitas dan nama usaha. Akun baru mendapat usaha tersendiri; usaha lama diberi ID `legacy-business`.

### `users`

Menyimpan `business_id`, username unik, nomor WhatsApp, hash dan salt password, foto profil, versi sesi, status aktif, serta waktu pembaruan. Password plaintext tidak disimpan. WhatsApp dinormalisasi menjadi digit dan unik jika terisi. Akun nonaktif tidak dapat login atau menggunakan sesi; setiap perubahan status menaikkan `session_version`.

### `products`

Menyimpan `business_id`, kode, barcode, nama, kategori, harga, stok, dan gambar. Kode dan barcode unik di dalam satu usaha. Harga harus positif; stok tidak boleh negatif. Gambar disimpan sebagai data URL WebP setelah kompresi, atau sebagai path aset untuk produk contoh awal.

### `transactions`

Menyimpan ID transaksi, `business_id`, waktu, subtotal, diskon, PPN, total, uang dibayar, kembalian, status member, metode pembayaran (`tunai` atau `qris`), dan label QR yang dipakai. QR yang digunakan diperiksa backend berdasarkan ID QR serta kepemilikan usaha dan status aktif; nama QR yang disimpan pada transaksi tidak berubah jika nama QR kemudian diedit atau dihapus.

### `business_payment_settings`

Tabel lama untuk satu QRIS per usaha. Pada migrasi `0009`, gambar QRIS yang tersimpan dipindahkan ke tabel `business_payment_qrs` dengan nama awal **QRIS**. Tabel lama dipertahankan untuk kompatibilitas data; pengelolaan QRIS baru tidak lagi memakai tabel ini.

### `business_payment_qrs`

Menyimpan daftar QRIS statis per usaha: ID, nama, gambar, status aktif, dan waktu pembuatan/perubahan. Nama unik tanpa membedakan kapitalisasi untuk tiap usaha; aplikasi membatasi jumlah hingga 10 QR per usaha. Setiap perubahan dibatasi oleh `business_id` sesi pemilik. Pembayaran QRIS tetap diperiksa secara manual oleh kasir sebelum transaksi disimpan.

### `transaction_items`

Menyimpan rincian item per transaksi: kode produk, nama dan harga saat transaksi, serta kuantitas. Relasi `transaction_id` mengarah ke `transactions`.

### `store_alerts`

Menyimpan notifikasi dan saran pada modul Pusat Perhatian Toko. Setiap baris terikat ke `business_id`, sehingga notifikasi antarusaha terpisah. `alert_key` menjadi identitas stabil suatu isu; indeks unik parsial memastikan hanya ada satu notifikasi aktif untuk isu yang sama dalam satu usaha. Notifikasi berstatus `selesai` atau `tidak_relevan` tidak menghalangi isu yang sama dibuat kembali di kemudian hari.

Kategori yang diizinkan: `stok`, `penjualan`, `produk`, `peluang`, dan `aktivitas`. Prioritas: `tinggi`, `sedang`, dan `info`. Status: `baru`, `dibaca`, `ditangani`, `selesai`, dan `tidak_relevan`. `evidence_json` menyimpan bukti/data pendukung; `action_label`, `action_type`, dan `action_payload_json` disediakan untuk tindakan lanjutan yang akan memerlukan validasi serta persetujuan pengguna. `read_at`, `resolved_at`, dan `expires_at` mendukung pengelolaan siklus notifikasi.

Badge notifikasi baru dihitung dari baris berstatus `baru` untuk `business_id` yang sedang login. Aplikasi tetap harus mengambil `business_id` dari sesi terverifikasi, bukan dari input bebas browser.

## Formula transaksi

- Member mendapat diskon 10% dari subtotal.
- Non-member mendapat diskon 5% jika subtotal minimal Rp100.000.
- PPN 11% dihitung dari subtotal setelah diskon.
- Stok berkurang setelah transaksi tervalidasi dan tersimpan.

Angka transaksi dan data stok di server dihitung kembali dari data D1, bukan dipercaya dari total yang dihitung hanya di browser.
