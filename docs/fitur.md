# Fitur

## Kasir dan katalog

- Mencari produk, memilih kategori, atau memindai barcode dengan kamera.
- Memasukkan barcode secara manual jika kamera tidak tersedia.
- Menambah, mengubah, dan menghapus produk; setiap barcode harus unik.
- Menyimpan foto produk; foto JPG/PNG/WebP dikompres sebelum dikirim.
- Mengelola keranjang, kuantitas, status member, pembayaran, dan kembalian.
- Memeriksa stok di server dan mengurangi stok hanya setelah transaksi sukses.
- Memutar suara transaksi sukses setelah penyimpanan dikonfirmasi server.

## Rekap dan analisis

- Melihat riwayat transaksi dan rincian barang.
- Memfilter data dan mengunduh rekap yang tampil sebagai CSV.
- Melihat total penjualan, produk terlaris, stok menipis, dan jam ramai.
- Smart Insight menghitung ringkasan dari D1. Jika `GEMINI_API_KEY` dikonfigurasi, hasil dapat dilengkapi analisis Gemini.
- Jika layanan Gemini sedang sibuk atau tidak tersedia, ringkasan cadangan tetap ditampilkan bersama pemberitahuan berbahasa Indonesia.

## Akun dan bantuan

- Pengguna dapat mendaftar akun usaha dengan nama usaha, nama pengguna, nomor WhatsApp, dan password.
- Data produk, transaksi, stok, laporan, serta profil dipisahkan untuk setiap usaha.
- Sesi menggunakan cookie `HttpOnly` dengan masa aktif 12 jam.
- Menu hamburger mengakses Kasir, Rekap, Smart Insight, Panduan, Profil, dan Keluar.
- Halaman Profil menampilkan nama usaha dan WhatsApp, serta dapat mengganti username, password dengan verifikasi password saat ini, dan foto profil.
- Panduan tersedia sebagai halaman website dan dokumentasi Markdown.
