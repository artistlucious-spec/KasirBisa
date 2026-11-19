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

1. Login memeriksa username dan password terhadap profil pemilik di D1.
2. Jika profil belum ada, backend membuatnya satu kali dari `KASIR_USERNAME` dan `KASIR_PASSWORD`, setelah tabel migrasi tersedia.
3. Password disimpan sebagai hash PBKDF2-SHA-256 dengan salt acak, bukan sebagai teks biasa.
4. Sesi ditandatangani dengan `AUTH_SESSION_SECRET`, disimpan dalam cookie `HttpOnly`, dan berlaku 12 jam.
5. Mengubah username atau password menaikkan versi sesi. Sesi pada perangkat lain menjadi tidak berlaku dan sesi aktif menerima cookie baru.
6. Foto profil dikompres menjadi WebP di browser dan disimpan pada kolom `owner_profile.profile_image`.

## Alur transaksi

Browser mengirim kode produk dan jumlah barang. Backend memeriksa produk, stok, pembayaran, diskon, dan PPN berdasarkan data D1, lalu menyimpan transaksi, item, dan pengurangan stok melalui batch D1. Suara konfirmasi dimainkan di browser setelah server mengembalikan transaksi sukses.
