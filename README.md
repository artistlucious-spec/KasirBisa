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

Project Pages dan binding D1 diatur sebagai `kasir-bisa`. Pastikan akun, project Pages, dan database yang dipilih memang milik aplikasi ini sebelum menjalankan perintah remote.

Atur secrets di environment Cloudflare Pages yang digunakan:

- `KASIR_USERNAME`: nama akun awal.
- `KASIR_PASSWORD`: password akun awal, minimal 12 karakter.
- `AUTH_SESSION_SECRET`: secret acak minimal 32 karakter.
- `GEMINI_API_KEY`: opsional, untuk membuat analisis dengan Gemini.
- `GEMINI_MODEL`: opsional; model default tersedia di `.dev.vars.example`.

Jalankan `npm run d1:migrate:remote` untuk menerapkan migrasi ke D1 remote yang dikonfigurasi. Migrasi `0003_owner_profile.sql` diperlukan untuk halaman Profil. Pada penggunaan pertama, username dan password dari secrets membuat profil awal di D1; setelah itu perubahan profil/password dikelola dari halaman Profil.

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