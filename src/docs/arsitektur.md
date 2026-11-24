# Arsitektur

## Ringkasan

Kasir Bisa Web memakai frontend statis tanpa framework build. Browser memuat halaman dari `src/`, kemudian berkomunikasi dengan API same-origin di `/api/*`. Cloudflare Pages Functions meneruskan route API ke handler bersama di `worker.js`; data persisten disimpan di Cloudflare D1.

```text
Browser
  |-- HTML, CSS, JavaScript, gambar, dan SFX (src/)
  |-- /api/* -> Cloudflare Pages Functions (functions/api/)
                    |-- autentikasi dan logika API (worker.js)
                    |-- D1 melalui binding DB
                    |-- Gemini API untuk Smart Insight AI (opsional)
```

## Komponen

- `src/index.html` dan `src/scripts/`: kasir, pemindai, katalog, keranjang, dan transaksi.
- `src/rekap.html`, `src/smart-insight.html`, `src/profile.html`, `src/panduan.html`: halaman pendukung.
- `src/scripts/auth-guard.js`: memeriksa sesi sebelum halaman privat digunakan dan mengikat aksi keluar.
- `src/scripts/navigation.js`: menu hamburger pada halaman privat.
- `src/scripts/image-utils.js`: validasi dasar dan kompresi foto di browser.
- `functions/api/`: route adapter Pages; setiap adapter meneruskan request ke handler `worker.js`.
- `worker.js`: memvalidasi autentikasi, mengolah request API, dan mengakses D1. Smart Insight dapat meminta analisis Gemini.
- `migrations/`: skema dan data awal D1.

## Autentikasi dan profil

1. Pengguna mendaftar usaha dan akun. Login menerima nama pengguna atau nomor WhatsApp beserta password.
2. Setiap akun terhubung ke satu usaha; seluruh API produk, transaksi, stok, dan insight membatasi kueri berdasarkan usaha pada sesi.
3. Migrasi `0004_multi_tenant_accounts.sql` memindahkan data dan profil lama ke usaha `legacy-business`. Pengguna lama harus login kembali setelah migrasi karena format sesi berubah.
4. Jika akun lama belum tersimpan, backend dapat membuatnya dari `KASIR_USERNAME` dan `KASIR_PASSWORD`.
5. Password disimpan sebagai hash PBKDF2-SHA-256 dengan salt acak dan 100.000 iterasi (batas Cloudflare Workers), bukan sebagai teks biasa.
   Untuk permintaan tampilan password di profil, aplikasi juga menyimpan salinan terenkripsi AES-GCM. Kunci AES diturunkan melalui HKDF dari `AUTH_SESSION_SECRET`; siapa pun yang memperoleh secret tersebut dan database dapat mendekripsi salinan password.
6. Sesi ditandatangani dengan `AUTH_SESSION_SECRET`, menyertakan ID akun dan versi sesi, disimpan dalam cookie `HttpOnly`, dan berlaku 12 jam.
7. Mengubah username atau password menaikkan versi sesi. Sesi pada perangkat lain menjadi tidak berlaku dan sesi aktif menerima cookie baru.
8. Foto profil dikompres menjadi WebP di browser dan disimpan pada `users.profile_image`.

## Alur transaksi

Browser mengirim kode produk dan jumlah barang. Backend memeriksa produk dan stok dalam ruang usaha pada sesi, menghitung pembayaran, diskon, dan PPN berdasarkan data D1, lalu menyimpan transaksi, item, dan pengurangan stok melalui batch D1. Suara konfirmasi dimainkan di browser setelah server mengembalikan transaksi sukses.
