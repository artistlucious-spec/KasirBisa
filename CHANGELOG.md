# Changelog

Perubahan penting pada website dicatat di sini.

## Belum dirilis

- Menambahkan pendaftaran akun usaha dan memisahkan produk, transaksi, stok, serta insight per usaha.
- Memindahkan akun dan data lama ke usaha legacy melalui migrasi `0004_multi_tenant_accounts.sql`.
- Menambahkan halaman Profil untuk mengubah username, password, dan foto profil.
- Menyimpan profil pemilik, hash password, foto, dan versi sesi di D1 melalui migrasi `0003_owner_profile.sql`.
- Mengakhiri sesi lain setelah username atau password diganti, sambil mempertahankan sesi perangkat aktif.
- Mengganti navigasi halaman privat dengan menu hamburger yang juga bisa ditutup melalui klik di luar menu atau tombol Escape.
- Menambahkan dokumentasi proyek untuk kebutuhan sistem, arsitektur, database, fitur, dan panduan pengguna.
- Menyelaraskan perintah deploy dan migrasi D1 dengan project Pages `kasirbisa`.
- Membatasi hash password PBKDF2 ke 100.000 iterasi agar sesuai dengan batas Cloudflare Workers.
