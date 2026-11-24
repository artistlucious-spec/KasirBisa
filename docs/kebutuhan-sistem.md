# Kebutuhan Sistem

## Pengguna

- Setiap pemilik usaha dapat membuat akun sendiri menggunakan nama usaha, nama pengguna, nomor WhatsApp, dan password.
- Data setiap usaha harus terisolasi; pengguna hanya dapat membaca atau mengubah data usahanya sendiri.
- Username yang dipilih melalui konfigurasi server `ADMIN_USERNAME` dapat melihat ringkasan akun dan mengubah status aktifnya; akses ini tidak boleh ditentukan oleh browser.
- Akun lama dipertahankan sebagai satu usaha terpisah setelah migrasi. Secret `KASIR_USERNAME` dan `KASIR_PASSWORD` tetap dapat dipakai untuk membuat akun lama jika belum tersimpan di D1.

## Perangkat dan browser

- Browser modern yang mendukung JavaScript, `fetch`, `createImageBitmap`, dan format WebP.
- Koneksi internet untuk mengakses Cloudflare Pages, D1, dan layanan Gemini jika Smart Insight AI digunakan.
- Kamera dan izin browser diperlukan untuk memindai barcode dengan kamera. Input barcode manual tetap tersedia.
- Akses HTTPS diperlukan agar fitur kamera tersedia di lingkungan produksi.

## Layanan dan konfigurasi

- Cloudflare Pages untuk hosting halaman statis dan Pages Functions.
- Cloudflare D1 terikat pada binding `DB`.
- Secret `AUTH_SESSION_SECRET` dengan panjang minimal 32 karakter.
- Variable `ADMIN_USERNAME` opsional untuk mengaktifkan akses admin bagi satu akun Kasir Bisa.
- Secret `KASIR_USERNAME` dan `KASIR_PASSWORD` (minimal 12 karakter) opsional, hanya untuk bootstrap akun lama saat diperlukan.
- `GEMINI_API_KEY` hanya diperlukan untuk membuat insight dengan Gemini; ringkasan dasar dihitung dari data D1.

Database harus menerapkan semua file migrasi dalam `migrations/`, termasuk `0004_multi_tenant_accounts.sql`, sebelum pendaftaran dan login digunakan. Migrasi tersebut memindahkan akun serta data lama ke usaha legacy dan mengharuskan pengguna lama login kembali. Pastikan migrasi remote menyasar database D1 dan project Cloudflare Pages `kasirbisa` yang benar.

## Batasan unggah foto

- Foto produk dan profil menerima JPG, PNG, atau WebP.
- File asli maksimal 12 MB dan dikompres di browser menjadi WebP.
- Data WebP tersimpan di D1 sebagai data URL; batas payload API adalah sekitar 140 KB.
