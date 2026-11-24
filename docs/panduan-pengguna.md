# Panduan Pengguna

Panduan ini melengkapi halaman [Panduan Penggunaan di aplikasi](../src/panduan.html).

## Login

Pilih **Daftar usaha** pada halaman masuk untuk membuat akun. Isi nama usaha, nama pengguna, nomor WhatsApp, password minimal 12 karakter, lalu ulangi password. Nama pengguna dan nomor WhatsApp hanya dapat digunakan pada satu akun. Setelah pendaftaran berhasil, Anda langsung masuk ke kasir.

Produk, stok, dan transaksi tersimpan di akun usaha Anda dan terpisah dari usaha lain. Untuk masuk kembali, gunakan nama pengguna atau nomor WhatsApp beserta password. Demi keamanan, Anda akan diminta masuk lagi setelah 12 jam; jika memakai perangkat bersama, pilih **Keluar** melalui menu (ikon tiga garis) setelah selesai.

## Mengubah profil

1. Buka menu (ikon tiga garis) dan pilih **Profil**.
2. Nama usaha dan nomor WhatsApp ditampilkan sebagai informasi akun. Password tersimpan ditampilkan sebagai titik-titik; tekan ikon mata untuk melihatnya. Ubah nama pengguna atau pilih foto JPG, PNG, atau WebP, lalu simpan perubahan. Foto maksimal 12 MB sebelum diperkecil otomatis. Akun lama perlu masuk kembali sekali setelah pembaruan agar password bisa ditampilkan.
3. Tekan ikon mata pada baris Password untuk melihat password tersimpan. Untuk menggantinya, pilih **Ganti password**. Nama pengguna akan disembunyikan agar perubahan nama dan password dilakukan terpisah. Isi password saat ini untuk verifikasi, password baru minimal 12 karakter, lalu ulangi password baru.
4. Pilih **Simpan perubahan**. Jika nama pengguna atau password berubah, Anda perlu masuk kembali di perangkat lain.
5. Untuk menyiapkan QRIS, unggah gambar QRIS milik usaha, centang **Aktifkan QRIS di halaman kasir**, lalu simpan pengaturan. Gambar maksimal 100 KB.

## Mengelola akun aplikasi

Halaman **Admin** hanya muncul untuk username yang ditetapkan pada konfigurasi server `ADMIN_USERNAME`. Di halaman tersebut, admin dapat mencari akun, melihat nama usaha, tanggal bergabung, jumlah produk/transaksi, lalu menonaktifkan atau mengaktifkan akun. Menonaktifkan akun mengakhiri sesi pengguna; pengguna perlu login kembali setelah diaktifkan. Halaman ini tidak menampilkan password dan tidak menghapus data usaha. Username akun admin dikunci dari perubahan di Profil agar hak admin tidak berpindah ke orang lain.

## Menyiapkan katalog

1. Buka halaman Kasir dan pilih **Tambah produk**.
2. Isi nama, barcode, kategori, harga, dan stok. Barcode produk harus unik.
3. Tambahkan foto jika diperlukan, lalu simpan.
4. Gunakan pencarian/filter untuk menemukan produk; pilih produk untuk memasukkannya ke keranjang.

## Mencatat transaksi

1. Pindai barcode dengan kamera, atau masukkan barcode manual.
2. Periksa isi keranjang dan kuantitas.
3. Pilih status member yang benar. Member mendapat diskon 10%; non-member mendapat diskon 5% jika subtotal minimal Rp100.000.
4. Pilih **Tunai** atau **QRIS**. Untuk tunai, masukkan jumlah uang yang diterima. Untuk QRIS, tampilkan gambar QR kepada pelanggan dan periksa pembayaran masuk di aplikasi bank atau penyedia QRIS Anda.
5. Tinjau ringkasan. Untuk QRIS, pilih **Pembayaran diterima & simpan** hanya setelah Anda memastikan pembayaran masuk. Stok berkurang setelah transaksi disimpan server.

## Rekap dan Smart Insight

- Gunakan halaman Rekap untuk mencari atau memfilter transaksi, lalu pilih **Unduh CSV** untuk mengekspor data yang tampil.
- Gunakan Smart Insight untuk melihat ringkasan penjualan, produk terlaris, stok menipis, dan jam ramai.
- Jika analisis tidak dapat diperbarui, ringkasan dari data transaksi yang tersedia tetap dapat dilihat. Coba lagi nanti atau hubungi pengelola Kasir Bisa jika kendala berlanjut.

## Jika terjadi masalah

- Kamera tidak tersedia: gunakan input barcode manual.
- Barcode ditolak: cari produk yang sudah memakai barcode tersebut.
- Pembayaran gagal: periksa jumlah uang dan stok produk. Untuk QRIS, pastikan pembayaran masuk sebelum menyimpan transaksi.
- Tidak dapat menyimpan perubahan profil: pastikan password saat ini benar dan nama pengguna belum digunakan akun lain. Jika masih gagal, hubungi pengelola Kasir Bisa.
- Jika diminta masuk kembali, gunakan nama pengguna atau nomor WhatsApp beserta password.

## Menggunakan Smart Insight
1. Buka menu Smart Insight.
2. Pilih Otomatis atau salah satu fokus yang tersedia.
3. Periksa prioritas, bukti, dan tindakan yang disarankan.
4. Tekan Buat insight baru untuk memperbarui analisis setelah transaksi atau stok berubah.

## Mengubah identitas toko
Buka Profil Usaha, ubah nama toko atau foto profil, lalu tekan Simpan perubahan. Identitas terbaru akan tampil pada header halaman aplikasi.

## Menyimpan atau membagikan struk
Setelah pembayaran berhasil, pilih Simpan gambar untuk mengunduh PNG, Bagikan untuk menggunakan fitur berbagi perangkat (atau alternatif WhatsApp berbentuk teks), dan Cetak untuk mencetak struk.
