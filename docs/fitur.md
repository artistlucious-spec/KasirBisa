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

## Smart Insight Hybrid
Smart Insight menggabungkan analisis otomatis dan fokus pilihan pemilik: otomatis, meningkatkan penjualan, mengelola stok, produk terlaris, atau produk kurang laku. Rekomendasi memuat temuan, bukti data, prioritas, dan tindakan. Analisis tren membandingkan dua periode tujuh hari. Risiko stok dihitung dari penjualan tujuh hari dan stok saat ini. Rekomendasi berbasis aturan tetap tersedia ketika layanan Gemini belum aktif. Analisis jam ramai ditunda sampai zona waktu usaha dapat ditentukan dengan benar.

## Identitas toko
Pemilik dapat memperbarui nama toko dan foto profil dari halaman Profil Usaha. Nama toko dan foto pemilik ditampilkan pada header halaman privat aplikasi.

## Struk digital
Setelah transaksi berhasil, struk ditampilkan dalam tata letak digital. Pengguna dapat menyimpan struk sebagai PNG, membagikan file melalui fitur berbagi perangkat jika didukung browser, atau mencetaknya. Jika berbagi gambar tidak didukung, aplikasi menyediakan alternatif berbagi ringkasan teks melalui WhatsApp.
