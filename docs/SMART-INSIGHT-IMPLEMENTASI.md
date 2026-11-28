# Implementasi Smart Insight — KASIR BISA

## Fitur yang ditambahkan
- `pusat-perhatian.html`: pusat notifikasi dengan filter, bukti, dan perubahan status.
- Tanya Smart Insight telah dihapus. Halaman Smart Insight tetap menyediakan analisis usaha, sedangkan Pusat Perhatian tetap menampilkan peringatan berbasis stok dan penjualan.
- Deteksi stok habis/rendah dan perubahan penjualan mingguan pada endpoint `/api/store-alerts`.
- Notifikasi disimpan pada tabel `store_alerts` dari migrasi `0006_store_alerts.sql`; isu aktif diperbarui berdasarkan `business_id` dan `alert_key`.
- Badge navigasi menghitung status `baru` saja.

## Endpoint baru
- `GET /api/store-alerts`
- `PATCH /api/store-alerts/:id`

## Konfigurasi lokal
1. Jalankan `npm install`.
2. Salin `.dev.vars.example` menjadi `.dev.vars`.
3. Isi `AUTH_SESSION_SECRET` dengan secret acak minimal 32 karakter.
4. Untuk AI melalui Helipod, isi `HELIPOD_API_KEY` dan sesuaikan `HELIPOD_MODEL` pada `.dev.vars`.
5. Terapkan migrasi lokal yang sudah ada, termasuk `0006_store_alerts.sql`, melalui `npm run d1:migrate:local`.
6. Jalankan `npm run dev`.

Tidak ada migrasi remote atau deployment yang dilakukan. Jangan mengunggah `.dev.vars`.

## Batasan yang diketahui
- AI Creation saat ini menghasilkan teks (caption, deskripsi, ide bundling, dan ringkasan) yang dapat disalin manual. Pembuatan poster/gambar belum diaktifkan karena source proyek tidak memiliki layanan image-generation.
- Deteksi stok memakai stok tercatat dan penjualan tujuh hari; tidak ada inferensi kedaluwarsa atau laba karena data pendukung tidak tersedia.
- Notifikasi diperbarui saat halaman Pusat Perhatian Toko dibuka/dimuat ulang, bukan melalui cron terjadwal.
- Pengujian koneksi Helipod membutuhkan API key valid dan akses jaringan Cloudflare/Helipod.
