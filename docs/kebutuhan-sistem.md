# Kebutuhan Sistem

## Pengguna

- Pemilik menggunakan akun tunggal untuk mengakses website.
- Tidak ada pendaftaran akun publik.
- Username dan password akun awal disiapkan oleh administrator Cloudflare.

## Perangkat dan browser

- Browser modern yang mendukung JavaScript, `fetch`, `createImageBitmap`, dan format WebP.
- Koneksi internet untuk mengakses Cloudflare Pages, D1, dan layanan Gemini jika Smart Insight AI digunakan.
- Kamera dan izin browser diperlukan untuk memindai barcode dengan kamera. Input barcode manual tetap tersedia.
- Akses HTTPS diperlukan agar fitur kamera tersedia di lingkungan produksi.

## Layanan dan konfigurasi

- Cloudflare Pages untuk hosting halaman statis dan Pages Functions.
- Cloudflare D1 terikat pada binding `DB`.
- Secret `AUTH_SESSION_SECRET` dengan panjang minimal 32 karakter.
- Secret `KASIR_USERNAME` dan `KASIR_PASSWORD` (minimal 12 karakter) untuk membuat akun pemilik pertama kali jika baris profil belum tersedia.
- `GEMINI_API_KEY` hanya diperlukan untuk membuat insight dengan Gemini; ringkasan dasar dihitung dari data D1.

Database harus menerapkan semua file migrasi dalam `migrations/`, termasuk `0003_owner_profile.sql`, sebelum halaman Profil digunakan. Pastikan migrasi remote menyasar database D1 dan project Cloudflare Pages `kasirbisa` yang benar.

## Batasan unggah foto

- Foto produk dan profil menerima JPG, PNG, atau WebP.
- File asli maksimal 12 MB dan dikompres di browser menjadi WebP.
- Data WebP tersimpan di D1 sebagai data URL; batas payload API adalah sekitar 140 KB.
