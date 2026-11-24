# Changelog

## Perbaikan akses login lokal
- Halaman login kini mendeteksi ketika dibuka langsung melalui `file://` dan menampilkan instruksi menjalankan server, bukan membiarkan pengguna menemui `Failed to fetch`.
- Menambahkan `.dev.vars.example` yang sebelumnya dirujuk panduan tetapi tidak ada di paket.
- Menambahkan `.gitignore` untuk mencegah file secret lokal dan direktori instalasi ikut terunggah.
- Tidak mengubah skema database, data, kredensial, maupun konfigurasi database Cloudflare.

# Changelog

Perubahan penting pada website dicatat di sini.

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
