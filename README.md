# Kasir Bisa Web

Aplikasi kasir web untuk mengelola katalog, transaksi, stok, rekap penjualan, dan Smart Insight. Antarmuka menggunakan warna biru dan ditujukan untuk pemilik usaha/kantin.

## Teknologi

- Frontend: HTML, CSS, dan JavaScript di `src/`.
- Hosting dan API: Cloudflare Pages Functions.
- Data: Cloudflare D1.
- Smart Insight: Gemini API (opsional; API key disimpan sebagai secret).

## Menjalankan secara lokal

1. Gunakan Node.js dan npm, lalu jalankan `npm install`.
2. Salin `.dev.vars.example` menjadi `.dev.vars` dan isi nilai lokal yang diperlukan. Jangan commit `.dev.vars`.
3. Terapkan migrasi D1 lokal dengan `npm run d1:migrate:local`.
4. Jalankan `npm run dev`, kemudian buka alamat lokal yang ditampilkan Wrangler.

Build statis dapat diperiksa dengan `npm run build`. Untuk pemeriksaan sintaks JavaScript, jalankan `node --check worker.js` dan `node --check` pada file di `src/scripts/`.

## Konfigurasi Cloudflare

Project Pages dan database D1 yang dipakai aplikasi bernama `kasirbisa`. Pastikan Wrangler menggunakan akun Cloudflare yang sama dengan project Pages sebelum menjalankan perintah remote.

Atur secrets di environment Cloudflare Pages yang digunakan:

- `AUTH_SESSION_SECRET`: secret acak minimal 32 karakter.
- `AUTH_SESSION_SECRET` juga digunakan untuk mengenkripsi salinan password yang bisa ditampilkan di profil. Jaga secret ini sangat ketat; siapa pun yang memiliki secret dan akses ke D1 dapat membaca password pengguna.
- `KASIR_USERNAME`: opsional, username akun lama jika perlu dibuat ulang.
- `KASIR_PASSWORD`: opsional, password akun lama minimal 12 karakter jika perlu dibuat ulang.
- `GEMINI_API_KEY`: opsional, untuk membuat analisis dengan Gemini.
- `GEMINI_MODEL`: opsional; model default tersedia di `.dev.vars.example`.

Pengguna baru dapat mendaftar melalui halaman **Daftar usaha**. Data setiap usaha dipisahkan di D1. Jalankan `npm run d1:migrate:remote` untuk menerapkan migrasi ke D1 remote yang dikonfigurasi; migrasi `0004_multi_tenant_accounts.sql` mempertahankan data lama di usaha legacy. Pengguna lama harus login kembali setelah migrasi `0005_password_encrypted.sql` agar salinan password terenkripsi tersimpan untuk ditampilkan di profil. Password lama yang sudah tersimpan sebagai hash tidak bisa dipulihkan sebelum login kembali.

Deploy website Pages dengan `npm run deploy`. Secrets tidak dimasukkan ke source code atau dibagikan.

## Struktur proyek

- `src/`: halaman, aset, CSS, dan JavaScript browser.
- `functions/api/`: route adapter Pages untuk API.
- `worker.js`: logika autentikasi dan API bersama.
- `migrations/`: migrasi skema dan data awal D1.
- `docs/`: dokumentasi kebutuhan, arsitektur, database, fitur, dan panduan.
- `CHANGELOG.md`: catatan perubahan.

## Dokumentasi

- [Kebutuhan sistem](docs/kebutuhan-sistem.md)
- [Arsitektur](docs/arsitektur.md)
- [Database](docs/database.md)
- [Fitur](docs/fitur.md)
- [Panduan pengguna](docs/panduan-pengguna.md)
- [Panduan dalam aplikasi](src/panduan.html)