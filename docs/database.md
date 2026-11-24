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

Jalankan `npm run d1:migrate:local` untuk D1 lokal. Setelah menerapkan `0005_password_encrypted.sql`, pengguna lama harus login kembali agar aplikasi dapat membuat salinan password terenkripsi dari password yang baru diverifikasi. Jalankan `npm run d1:migrate:remote` hanya setelah memastikan akun Cloudflare dan database remote yang dikonfigurasi adalah milik project Pages `kasirbisa`. Jangan menjalankan migrasi remote tanpa memeriksa target database.

## Tabel

### `businesses`

Menyimpan identitas dan nama usaha. Akun baru mendapat usaha tersendiri; usaha lama diberi ID `legacy-business`.

### `users`

Menyimpan `business_id`, username unik, nomor WhatsApp, hash dan salt password, foto profil, versi sesi, status aktif, serta waktu pembaruan. Password plaintext tidak disimpan. WhatsApp dinormalisasi menjadi digit dan unik jika terisi. Akun nonaktif tidak dapat login atau menggunakan sesi; setiap perubahan status menaikkan `session_version`.

### `products`

Menyimpan `business_id`, kode, barcode, nama, kategori, harga, stok, dan gambar. Kode dan barcode unik di dalam satu usaha. Harga harus positif; stok tidak boleh negatif. Gambar disimpan sebagai data URL WebP setelah kompresi, atau sebagai path aset untuk produk contoh awal.

### `transactions`

Menyimpan ID transaksi, `business_id`, waktu, subtotal, diskon, PPN, total, uang dibayar, kembalian, status member, dan metode pembayaran (`tunai` atau `qris`). Riwayat sebelum migrasi `0007` dianggap sebagai transaksi tunai.

### `business_payment_settings`

Menyimpan status QRIS dan gambar QRIS statis yang dimiliki masing-masing usaha. Setiap pengaturan terikat ke `business_id` dari sesi login; gambar hanya ditampilkan kepada pengguna usaha tersebut. QRIS statis memerlukan pemeriksaan pembayaran manual oleh kasir sebelum transaksi disimpan.

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
