# Changelog

## Perbaikan akses login lokal
- Halaman login kini mendeteksi ketika dibuka langsung melalui `file://` dan menampilkan instruksi menjalankan server, bukan membiarkan pengguna menemui `Failed to fetch`.
- Menambahkan `.dev.vars.example` yang sebelumnya dirujuk panduan tetapi tidak ada di paket.
- Menambahkan `.gitignore` untuk mencegah file secret lokal dan direktori instalasi ikut terunggah.
- Tidak mengubah skema database, data, kredensial, maupun konfigurasi database Cloudflare.

# Changelog

Perubahan penting pada website dicatat di sini.

## Multi-QRIS per usaha (belum diterapkan ke D1 remote)
- Menambahkan halaman privat `qr.html` yang dibuka melalui opsi QRIS di Kasir, tanpa menambahkan tautan ke navigasi umum atau Profil Usaha.
- Pemilik dapat menyimpan hingga 10 QRIS bernama, mengedit nama/gambar, memilih area crop dengan kotak yang bisa digeser dan diubah ukurannya, mengaktifkan/menonaktifkan, serta menghapus QR.
- Checkout memilih satu QR aktif, tetap memerlukan pengecekan pembayaran manual, dan mencatat nama QR pada struk serta riwayat/CSV.
- Menambahkan migrasi `0009_multiple_payment_qrs.sql`; migrasi ini perlu diterapkan terpisah pada D1 Cloudflare. Tidak ada migrasi remote atau deploy yang dilakukan.

## Pemilihan area gambar QRIS tanpa menghapus gambar asli
- QRIS yang ditampilkan mengikuti area terpilih, sementara gambar sumber utuh dan posisi seleksi disimpan agar pilihan dapat diubah saat pengeditan berikutnya.
- Menambahkan migrasi `0010_nondestructive_qr_selection.sql`; perlu diterapkan terpisah pada D1 sebelum source terbaru digunakan.

## Nama metode pembayaran dikembalikan ke QRIS
- Mengembalikan label metode, pengaturan, pesan, struk, dan riwayat dari "QR Pembayaran" ke "QRIS" sesuai keputusan pengguna.
- Fitur tetap hanya mendukung satu gambar QRIS per usaha; usulan multi-QR ditunda. Tidak ada perubahan skema database.

## QR Pembayaran dan panduan pengguna
- Mengganti label pengguna "QRIS" menjadi "QR Pembayaran" agar sesuai dengan kode QR dari penyedia pembayaran berbeda seperti DANA, GoPay, ShopeePay, atau QRIS; nilai internal dan transaksi lama tetap kompatibel.
- Memperbarui panduan di aplikasi dan dokumentasi untuk Produk & Stok, pembayaran, struk, riwayat, laporan, Smart Insight, Tanya Smart Insight, serta Pusat Perhatian Toko.
- Halaman Admin tidak dimasukkan ke dalam panduan pengguna.

## Dasbor admin akun
- Menambahkan halaman Admin dengan pencarian akun, ringkasan jumlah produk/transaksi, dan kontrol aktif/nonaktif akun.
- Membatasi endpoint admin di backend berdasarkan `ADMIN_USERNAME`; akun nonaktif ditolak saat login maupun saat memakai sesi lama.
- Menambahkan migrasi `0008_admin_accounts.sql`; tidak menerapkan migrasi ke D1 remote atau melakukan deploy.

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


## Peningkatan Smart Insight, profil toko, dan struk digital
- Smart Insight kini mendukung fokus otomatis atau pilihan pemilik, tren 7 hari, risiko stok berbasis laju penjualan, produk tidak bergerak, dan kombinasi produk.
- Analisis transaksi menggunakan satu JOIN untuk menghindari query item berulang. Rekomendasi berbasis aturan tetap tersedia tanpa Gemini.
- Nama toko dapat diedit dari Profil Usaha; nama toko dan foto pemilik tampil pada header lintas halaman.
- Struk transaksi memiliki tampilan digital dan dapat disimpan sebagai PNG, dibagikan, atau dicetak.
- Tidak ada perubahan skema database atau file migrasi.


## Fondasi Pusat Perhatian Toko
- Menambahkan migrasi `0006_store_alerts.sql` untuk tabel notifikasi per usaha, status tindak lanjut, prioritas, bukti analisis, metadata tindakan, dan masa berlaku.
- Menambahkan indeks unik parsial agar satu isu aktif tidak menghasilkan notifikasi duplikat dalam usaha yang sama. Isu yang sudah selesai atau tidak relevan dapat muncul kembali.
- Belum menambahkan endpoint, proses deteksi, badge navigasi, maupun antarmuka notifikasi; migrasi ini menyiapkan lapisan penyimpanan terlebih dahulu.
- Tidak mengubah migrasi lama, tabel lama, maupun logika transaksi/kasir.
