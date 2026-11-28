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
- Smart Insight menghitung ringkasan dari D1. Jika `HELIPOD_API_KEY` dikonfigurasi, hasil dapat dilengkapi analisis AI dari Helipod.
- Jika layanan Helipod sedang sibuk atau tidak tersedia, ringkasan cadangan tetap ditampilkan bersama pemberitahuan berbahasa Indonesia.

## Akun dan bantuan

- Pengguna dapat mendaftar akun usaha dengan nama usaha, nama pengguna, nomor WhatsApp, dan password.
- Data produk, transaksi, stok, laporan, serta profil dipisahkan untuk setiap usaha.
- Pengelola yang ditentukan melalui `ADMIN_USERNAME` dapat melihat ringkasan akun dan mengaktifkan atau menonaktifkannya melalui halaman Admin.
- Sesi menggunakan cookie `HttpOnly` dengan masa aktif 12 jam.
- Menu hamburger mengakses Kasir, Produk & Stok, Riwayat Transaksi, Laporan Penjualan, Smart Insight, Panduan, Profil, dan Keluar. Pusat Perhatian Toko dibuka dari tautan di halaman Smart Insight.
- Halaman Profil menampilkan nama usaha dan WhatsApp, serta dapat mengganti username, password dengan verifikasi password saat ini, dan foto profil.
- Panduan tersedia sebagai halaman website dan dokumentasi Markdown.

## Smart Insight Hybrid
Smart Insight menggabungkan analisis berbasis aturan dengan fokus pilihan pemilik: otomatis, meningkatkan penjualan, mengelola stok, produk terlaris, atau produk kurang laku. Analisis hanya dijalankan setelah pengguna menekan tombol **Analisis sekarang**; membuka halaman atau mengubah fokus tidak memanggil layanan AI. Hasil AI untuk usaha, fokus, model, dan ringkasan data yang sama digunakan ulang selama 10 menit. Konteks AI dibatasi pada ringkasan produk terpilih dan jawaban maksimal 250 token. Rekomendasi memuat temuan, bukti data, prioritas, dan tindakan. Analisis tren membandingkan dua periode tujuh hari. Risiko stok dihitung dari penjualan tujuh hari dan stok saat ini. Rekomendasi berbasis aturan tetap tersedia ketika layanan AI belum aktif. Analisis jam ramai ditunda sampai zona waktu usaha dapat ditentukan dengan benar.

## Identitas toko
Pemilik dapat memperbarui nama toko dan foto profil dari halaman Profil Usaha. Nama toko dan foto pemilik ditampilkan pada header halaman privat aplikasi.

## Struk digital
Setelah transaksi berhasil, struk ditampilkan dalam tata letak digital. Pengguna dapat menyimpan struk sebagai PNG, membagikan file melalui fitur berbagi perangkat jika didukung browser, atau mencetaknya. Jika berbagi gambar tidak didukung, aplikasi menyediakan alternatif berbagi ringkasan teks melalui WhatsApp.
