# Implementasi Smart Insight — KASIR BISA

## Fitur yang ditambahkan
- `pusat-perhatian.html`: pusat notifikasi dengan filter, bukti, dan perubahan status.
- `tanya-smart-insight.html`: ruang percakapan terpisah dengan mode konsultasi, AI Creation teks, dan AI Action.
- Deteksi stok habis/rendah dan perubahan penjualan mingguan pada endpoint `/api/store-alerts`.
- Notifikasi disimpan pada tabel `store_alerts` dari migrasi `0006_store_alerts.sql`; isu aktif diperbarui berdasarkan `business_id` dan `alert_key`.
- Chat menggunakan data produk dan transaksi dari usaha yang sedang login.
- AI Action membuat preview bertanda tangan HMAC yang berlaku 5 menit. Perubahan produk hanya dilakukan pada endpoint konfirmasi, dengan pemeriksaan ulang `business_id` dan kondisi stok/harga.
- Badge navigasi menghitung status `baru` saja.

## Endpoint baru
- `GET /api/store-alerts`
- `PATCH /api/store-alerts/:id`
- `POST /api/smart-insight/chat`
- `POST /api/smart-insight/action/prepare`
- `POST /api/smart-insight/action/confirm`

## Konfigurasi lokal
1. Jalankan `npm install`.
2. Salin `.dev.vars.example` menjadi `.dev.vars`.
3. Isi `AUTH_SESSION_SECRET` dengan secret acak minimal 32 karakter.
4. Untuk AI, isi `GEMINI_API_KEY` dan sesuaikan `GEMINI_MODEL` pada `.dev.vars`.
5. Terapkan migrasi lokal yang sudah ada, termasuk `0006_store_alerts.sql`, melalui `npm run d1:migrate:local`.
6. Jalankan `npm run dev`.

Tidak ada migrasi remote atau deployment yang dilakukan. Jangan mengunggah `.dev.vars`.

## Batasan yang diketahui
- AI Creation saat ini menghasilkan teks (caption, deskripsi, ide bundling, dan ringkasan) yang dapat disalin manual. Pembuatan poster/gambar belum diaktifkan karena source proyek tidak memiliki layanan image-generation.
- Riwayat chat disimpan selama halaman percakapan terbuka; belum disimpan permanen ke database.
- Deteksi stok memakai stok tercatat dan penjualan tujuh hari; tidak ada inferensi kedaluwarsa atau laba karena data pendukung tidak tersedia.
- Notifikasi diperbarui saat halaman Pusat Perhatian Toko dibuka/dimuat ulang, bukan melalui cron terjadwal.
- Pengujian koneksi Gemini membutuhkan API key valid dan akses jaringan Cloudflare/Gemini.
