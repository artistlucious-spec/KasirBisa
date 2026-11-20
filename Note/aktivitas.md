# Aktivitas

## Ringkasan untuk memahami perubahan

### Intinya

Kasir Bisa sudah memiliki halaman dan kode untuk mendaftar. Pendaftaran gagal di website produksi karena database yang dipakai situs belum memiliki tabel untuk menyimpan akun dan usaha. Saya menerapkan migrasi database yang diperlukan, lalu menguji endpoint pendaftaran live. **Tidak perlu mengulang deploy untuk perbaikan ini.**

### Apa yang dilakukan

1. Memastikan database produksi yang dipakai Cloudflare Pages adalah D1 `kasirbisa`, ID `520d3b0f-e730-4a12-ad88-7b68afffce83`.
2. Memastikan skema lama belum memiliki tabel `businesses` dan `users`, padahal endpoint signup membutuhkannya.
3. Memastikan riwayat migrasi lama cocok dengan skema/data yang sudah ada, lalu menerapkan hanya [migrasi 0004](<./kasir bisa web/migrations/0004_multi_tenant_accounts.sql>) pada database tersebut. Wrangler membuat backup otomatis sebelum menerapkan migrasi.
4. Menguji endpoint signup pada website produksi. Responsnya **HTTP 201** dengan `success: true`.
5. Menghapus akun uji dan bisnis kosong yang dibuat khusus untuk pengujian. Data uji tidak tertinggal.

### Cara kerja pendaftaran dan login

- [signup.html](<./kasir bisa web/src/signup.html>) adalah halaman formulir pendaftaran. Formulir meminta nama usaha, nama pengguna, WhatsApp, dan password minimal 12 karakter.
- [signup.js](<./kasir bisa web/src/scripts/signup.js>) memeriksa bahwa password dan konfirmasinya sama, lalu mengirim data ke `POST /api/auth/signup`.
- [fungsi Pages signup](<./kasir bisa web/functions/api/auth/signup.js>) meneruskan permintaan Cloudflare Pages ke kode backend di [worker.js](<./kasir bisa web/worker.js>).
- Backend memeriksa input dan duplikasi nama pengguna/nomor WhatsApp, meng-hash password, menyimpan usaha dan penggunanya, lalu membuat sesi login.
- [login.js](<./kasir bisa web/src/scripts/login.js>) menangani login. Pengguna masuk dengan nama pengguna atau nomor WhatsApp dan password.

### Mengapa database punya tabel usaha dan pengguna?

Setiap usaha disimpan sebagai satu `business`. Pengguna terhubung ke usahanya, dan produk serta transaksi diberi `business_id`. Dengan begitu, data satu usaha tidak tercampur dengan usaha lain.

Saat migrasi, pemilik dan data lama dipindahkan ke usaha legacy bernama “Usaha Saya”. Migrasi tidak mengganti produk atau transaksi lama; migrasi hanya menambahkan hubungan pemilik usaha dan memperbarui struktur tabelnya.

### Hasil pemeriksaan data

| Pemeriksaan | Hasil |
|---|---:|
| Bisnis setelah migrasi | 1 |
| Pengguna legacy setelah migrasi | 1 |
| Produk sebelum dan sesudah | 15 |
| Transaksi sebelum dan sesudah | 4 |
| Item transaksi sebelum dan sesudah | 6 |
| Item transaksi tanpa transaksi | 0 |
| Akun/bisnis uji yang tersisa | 0 |
| Migrasi yang masih tertunda | 0 |

### Yang tidak dilakukan dan catatan penting

- Kode aplikasi signup/login sudah ada dari pekerjaan sebelumnya. Dalam perbaikan terbaru ini saya **tidak mengubah source code, workflow GitHub, atau melakukan deploy**; perubahan utamanya ada pada database produksi.
- Tes signup dilakukan langsung ke API produksi dengan akun uji terpisah, bukan dengan mengirim formulir yang sedang terbuka di browser.
- Tab Yoti yang terlihat di Chrome tidak terkait dengan Kasir Bisa dan tidak dipakai.
- Login Wrangler hanya dipakai untuk mengakses D1 dan memakai izin minimum (`d1:write`, `account:read`, `user:read`, `offline_access`). Token Wrangler tersimpan di komputer lokal, bukan di source code atau repository. Akses aplikasi Wrangler dapat dicabut di Cloudflare pada **Profile → Access Management → Connected Applications**.
- **Konfigurasi Wrangler lokal masih menunjuk database berbeda:** [wrangler.toml](<./kasir bisa web/wrangler.toml>) dan skrip migrasi di [package.json](<./kasir bisa web/package.json>) memakai nama `kasir-bisa` dan ID `6676ee36-dbb3-448e-b99c-27ca0684e9fa`. Database live yang dipakai Pages adalah `kasirbisa` dengan ID `520d3b0f-e730-4a12-ad88-7b68afffce83`. Jangan menjalankan skrip migrasi lokal sebelum target tersebut diperbaiki.

### Yang perlu dilakukan sekarang

Buka [halaman signup produksi](https://kasirbisa.pages.dev/signup) dan daftar dengan akun Anda sendiri. Jika pendaftaran masih gagal, kirim pesan error atau screenshot tanpa memperlihatkan password.

### Kalimat singkat untuk presentasi

> “Kasir Bisa versi web mendukung pendaftaran akun usaha. Data tiap usaha dipisahkan, dan data produk serta transaksi lama tetap terjaga.”

---

## 2026-11-19

- Memastikan binding Cloudflare Pages `DB` mengarah ke database produksi `kasirbisa` (`520d3b0f-e730-4a12-ad88-7b68afffce83`).
- Pemeriksaan baca-saja sebelum migrasi: 15 produk, 4 transaksi, dan 6 item transaksi; tabel `businesses` dan `users` belum ada. Tidak ada data yang diubah.
- Mencoba menyiapkan SQL migrasi lewat D1 Studio; editor tidak menerima input. Tidak ada SQL yang dijalankan.
- Dua percobaan `wrangler login` berakhir karena waktu menunggu callback OAuth habis. Wrangler meminta 30 izin, dan pengguna menyetujui akses tersebut dengan syarat aktivitas dicatat di file ini.
- Tombol `Authorize` sempat ditekan pada halaman persetujuan OAuth yang tampaknya berasal dari percobaan lama; sesi Wrangler tetap tidak selesai. Izin aplikasi mungkin sudah tercatat di Cloudflare, sehingga statusnya perlu diverifikasi. Tidak ada perintah migrasi yang dijalankan.
- `wrangler whoami` memastikan token lokal masih terhubung ke akun Cloudflare yang berbeda dari akun pemilik database produksi. Tidak ada migrasi yang dijalankan; saya tidak akan memakai token tersebut untuk mengubah database.
- Memeriksa opsi Wrangler: login bisa dibatasi ke izin minimum untuk D1 dan identitas akun. Saya akan memakai cakupan minimum dan tidak melakukan deploy.
- Percobaan login dengan izin minimum juga timeout karena tautan OAuth belum sempat dibuka; token tetap belum dikonfirmasi untuk akun yang benar. Saya menemukan kolom alamat yang bisa diakses pada tab baru Chrome untuk percobaan berikutnya.
- Percobaan login minimum berikutnya menampilkan halaman persetujuan untuk akun yang benar, `artistlucious@gmail.com`, dengan izin User Read, Background Access, satu izin Developer Platform, dan satu izin Account & Billing. Proses Wrangler timeout sebelum persetujuan diproses. Pengguna menyetujui pemberian akses untuk migrasi D1 yang disebutkan, tetapi saya tidak menekan Authorize pada sesi kedaluwarsa; belum ada migrasi atau perubahan database.
- Login Wrangler kemudian berhasil pada `artistlucious@gmail.com` (Cloudflare account ID `ca6ae79ceb5a9726254487ac0dd8529d`). `wrangler d1 list` mengonfirmasi database produksi `kasirbisa`, ID `520d3b0f-e730-4a12-ad88-7b68afffce83`. Pemeriksaan read-only menemukan tabel `owner_profile`, `products`, `transactions`, dan `transaction_items`, dengan jumlah 1, 15, 4, dan 6; migrasi `0004` belum dijalankan. Untuk menghindari binding Wrangler lokal yang stale, target berikutnya akan dipilih menggunakan UUID database tersebut secara eksplisit.
- Pemeriksaan baseline juga memastikan 14 produk dari seed migrasi `0002` sudah ada. `wrangler d1 migrations list` membuat tabel riwayat `d1_migrations` yang sebelumnya belum ada; hasil baca menunjukkan tabel itu kosong. Percobaan membuat tabel manual ditolak karena tabel sudah ada, tanpa mengubah data bisnis. Sebelum `0004`, saya akan menandai `0001`–`0003` sebagai baseline yang sudah tercermin pada skema/data produksi agar Wrangler tidak menjalankan ulang seed. Migrasi `0004` akan dijalankan melalui perintah migrations pada konfigurasi sementara yang menunjuk UUID produksi; konfigurasi proyek yang stale tidak diubah.
- Migrasi `0004_multi_tenant_accounts.sql` berhasil diterapkan pada UUID produksi melalui konfigurasi sementara; Wrangler melaporkan keberhasilan dan backup otomatis. Verifikasi sesudah migrasi: 1 bisnis, 1 user legacy, 15 produk (semuanya pada bisnis legacy), 4 transaksi, 6 item transaksi, 0 item yatim, dan 1 kredensial legacy lengkap. Riwayat mencatat migrasi `0001`–`0004`.
- Daftar proyek Pages melalui Wrangler gagal karena token berizin minimum tidak memiliki cakupan Pages; saya tidak meminta izin tambahan. Domain produksi yang teridentifikasi dari proyek `kasirbisa`, `https://kasirbisa.pages.dev/signup`, merespons HTTP 200. Tes akan memakai domain ini, bukan URL preview yang sedang terbuka di browser pengguna.
- Pengguna menyetujui satu akun uji sementara dan penghapusan akun/bisnis kosongnya. POST ke `https://kasirbisa.pages.dev/api/auth/signup` berhasil dengan HTTP 201 dan `success: true`. Akun uji `kasirbisa_test_20261119_120032` serta bisnis kosong yang dibuat tes sudah dihapus secara terarah. Verifikasi akhir: akun/bisnis uji tersisa 0; data produksi tetap 1 bisnis, 1 user legacy, 15 produk, 4 transaksi, 6 item transaksi, dan 0 item yatim. Wrangler mengonfirmasi tidak ada migrasi yang tertunda.
- Konfigurasi migrasi sementara dan empat file penangkap output OAuth di direktori Temp telah dibersihkan. `wrangler.toml`, `package.json`, dan proses deploy GitHub tidak diubah.
