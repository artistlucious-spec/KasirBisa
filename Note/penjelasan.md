# Panduan Proyek Kasir Bisa Web

Dokumen ini menjadi titik awal untuk guru, pembaca kode, atau AI yang akan mempelajari dan memperbaiki proyek. Isinya mengikuti struktur folder dan kode aplikasi saat dokumentasi ini dibuat.

> **Sebelum mencoba menjalankan aplikasi:** baca [Informasi Penting Sebelum Menjalankan Kasir Bisa](info%20penting.md). Aplikasi memerlukan API dan database; membuka file HTML langsung tidak cukup. Panduan itu juga menjelaskan cara menjalankan lokal, mengganti `database_id` untuk akun Cloudflare baru, dan mengapa alamat website boleh berbeda dari nama database `kasirbisa`.

## 1. Ringkasan

Kasir Bisa Web adalah aplikasi kasir untuk katalog produk, stok, pembayaran, riwayat transaksi, profil pemilik, dan ringkasan penjualan.

- **Browser:** HTML, CSS, dan JavaScript tanpa framework frontend.
- **Hosting dan API:** Cloudflare Pages dan Pages Functions.
- **Database:** Cloudflare D1 (SQLite).
- **Analisis AI:** Gemini API opsional. Tanpa key, aplikasi tetap membuat ringkasan dasar dari data.
- **Bahasa antarmuka:** Indonesia; nama file, kolom data, dan pesan antarmuka banyak memakai istilah Indonesia.

Tidak ada langkah kompilasi framework. File website berada langsung di `src/`; perintah `npm run build` saat ini hanya mencetak informasi tersebut, bukan membuat bundel.

## 2. Cara menjalankan

Jalankan perintah dari folder `kasir bisa web/`, bukan dari folder induknya.

```powershell
npm install
Copy-Item .dev.vars.example .dev.vars
# Isi AUTH_SESSION_SECRET lokal dengan secret acak minimal 32 karakter.
npm run d1:migrate:local
npm run dev
```

Setelah Wrangler menampilkan alamat lokal, buka alamat itu di browser. Isi `.dev.vars` sesuai kebutuhan lokal; `GEMINI_API_KEY` hanya diperlukan untuk analisis Gemini. Jangan membagikan atau mengunggah `.dev.vars`, nilai secret, token, ataupun database lokal.

Perintah lain:

| Perintah | Tujuan |
|---|---|
| `npm run build` | Pemeriksaan placeholder; belum menjalankan compiler atau test. |
| `node --check worker.js` | Memeriksa sintaks JavaScript backend. |
| `node --check src/scripts/nama-file.js` | Memeriksa sintaks salah satu skrip browser. |
| `npm run d1:migrate:local` | Menerapkan migrasi ke database lokal Wrangler. |
| `npm run d1:migrate:remote` | Menerapkan migrasi ke D1 Cloudflare; pastikan akun dan target benar sebelum menjalankan. |
| `npm run deploy` | Mengirim folder `src/` ke Cloudflare Pages project `kasirbisa`. |

`package.json` belum menyediakan skrip test otomatis. Jangan menjalankan migrasi remote atau deploy sebagai bagian dari uji coba lokal.
Skrip `npm run dev` menjalankan Pages Functions lokal dengan `--env-file .dev.vars`; pastikan file itu sudah dibuat dari `.dev.vars.example` dan berisi `AUTH_SESSION_SECRET` sebelum membuka halaman login.

## 3. Cara kerja dan tempat menelusuri perubahan

```text
Halaman src/*.html
    -> skrip src/scripts/*.js
    -> fetch("/api/...")
    -> adapter functions/api/...
    -> worker.js
    -> Cloudflare D1 melalui binding DB
```

Untuk permintaan perubahan, telusuri dari halaman yang terlihat sampai ke penyimpanan:

1. HTML menyediakan elemen dan `id` yang dipakai JavaScript.
2. Skrip browser mengatur interaksi, validasi awal, dan pemanggilan API.
3. Berkas di `functions/api/` hanya menghubungkan URL ke handler bersama.
4. `worker.js` adalah sumber utama aturan backend, pemeriksaan sesi, validasi server, dan kueri database.
5. `migrations/` adalah sumber skema database. Perubahan skema baru harus memakai file migrasi baru, bukan mengedit migrasi yang sudah dipakai.

### Endpoint API

| URL | Route adapter | Tugas |
|---|---|---|
| `POST /api/auth/signup` | `functions/api/auth/signup.js` | Membuat usaha dan pengguna. |
| `POST /api/auth/login` | `functions/api/auth/login.js` | Memverifikasi username/WhatsApp dan password. |
| `POST /api/auth/logout` | `functions/api/auth/logout.js` | Menghapus cookie sesi. |
| `GET /api/auth/session` | `functions/api/auth/session.js` | Memeriksa sesi browser. |
| `GET` / `PUT /api/auth/profile` | `functions/api/auth/profile.js` | Membaca dan memperbarui profil. |
| `GET` / `POST /api/products` | `functions/api/products.js` | Membaca katalog atau menambahkan produk. |
| `PUT` / `DELETE /api/products/{code}` | `functions/api/products/[code].js` | Mengubah atau menghapus satu produk. |
| `GET` / `POST /api/transactions` | `functions/api/transactions.js` | Membaca riwayat atau menyimpan checkout. |
| `POST /api/smart-insight` | `functions/api/smart-insight.js` | Menghitung fakta penjualan dan meminta analisis opsional. |

### Aturan penting yang perlu dipertahankan

- Setiap produk dan transaksi terikat ke `business_id` dari sesi; jangan mengambil ruang usaha dari data yang dikirim browser.
- Browser boleh menghitung subtotal untuk tampilan, tetapi backend harus memverifikasi harga, stok, pembayaran, dan total sebelum menyimpan transaksi.
- Transaksi, item, dan pengurangan stok disimpan bersama melalui batch database.
- Hash password dipakai untuk verifikasi. Cookie sesi bertanda tangan dan berlaku 12 jam.
- Foto dikompres di browser menjadi WebP sebelum disimpan sebagai data URL di D1.
- Diskon member 10%; non-member mendapat 5% untuk subtotal minimal Rp100.000. PPN 11% dihitung setelah diskon.
- Perubahan skema harus disertai migrasi baru dan dokumentasi terkait.

## 4. Peta folder lengkap aplikasi

Setiap berkas proyek di luar direktori hasil instalasi/cache disebutkan di bawah. File media memiliki kegunaan berdasarkan nama, lokasi, dan pemakaiannya; file gambar/bunyi bukan kode yang perlu diedit untuk memperbaiki aturan bisnis.

```text
kasir bisa web/
├── .dev.vars.example
├── .gitignore
├── CHANGELOG.md
├── package-lock.json
├── package.json
├── PANDUAN-ARSITEKTUR.md
├── README.md
├── worker.js
├── wrangler.toml
├── docs/
│   ├── arsitektur.md
│   ├── database.md
│   ├── fitur.md
│   ├── kebutuhan-sistem.md
│   ├── panduan-pengguna.md
├── functions/api/
│   ├── products.js
│   ├── smart-insight.js
│   ├── transactions.js
│   ├── auth/
│   │   ├── login.js
│   │   ├── logout.js
│   │   ├── profile.js
│   │   ├── session.js
│   │   └── signup.js
│   └── products/[code].js
├── migrations/
│   ├── 0001_initial.sql
│   ├── 0002_seed_products.sql
│   ├── 0003_owner_profile.sql
│   ├── 0004_multi_tenant_accounts.sql
│   └── 0005_password_encrypted.sql
├── Note/
│   ├── aktivitas.md
│   ├── bindings.png
│   ├── bug/
│   │   ├── bug lagi.png
│   │   ├── bug password.png
│   │   ├── bug search.jpeg
│   │   ├── WhatsApp Image 2026-11-20 at 14.12.47.jpeg
│   │   ├── WhatsApp Image 2026-11-20 at 14.12.48.jpeg
│   │   └── WhatsApp Image 2026-11-20 at 14.12.49.jpeg
│   ├── info penting.md
│   ├── link.md
│   ├── log.md
│   ├── penjelasan.md
│   └── Proposal STEAMPreneur SMKN 6 KDI Tahun 2026.pdf
└── src/
    ├── index.html
    ├── login.html
    ├── panduan.html
    ├── profile.html
    ├── rekap.html
    ├── signup.html
    ├── smart-insight.html
    ├── assets/
    │   ├── css/style.css
    │   ├── images/
    │   │   ├── bakwan.png
    │   │   ├── biskuit.png
    │   │   ├── bukutulis.png
    │   │   ├── mineral.png
    │   │   ├── nasigoreng.png
    │   │   ├── nasikuning
    │   │   ├── nasikuning.png
    │   │   ├── pembalutwanita.png
    │   │   ├── placeholder-produk.png
    │   │   ├── popmiekari.png
    │   │   ├── popmiekorea.png
    │   │   ├── popmierawit.png
    │   │   ├── pulpen.png
    │   │   ├── susukotak.png
    │   │   ├── tahuisi.png
    │   │   ├── TARUH_GAMBAR_DI_SINI.txt
    │   │   ├── telurgulung.png
    │   │   └── tisubasah.png
    │   └── sfx/buy.mp3
    ├── icon/Favicon.png
    └── scripts/
        ├── app.js
        ├── auth-guard.js
        ├── image-utils.js
        ├── kasir.js
        ├── login.js
        ├── navigation.js
        ├── profile.js
        ├── rekap.js
        ├── signup.js
        └── smart-insight.js
```

## 5. Keterangan setiap file dan aset

### Konfigurasi dan dokumentasi utama

| File | Isi dan kegunaan |
|---|---|
| `.dev.vars.example` | Contoh nama variabel lokal untuk secret autentikasi, akun legacy opsional, serta Gemini. Isinya contoh, bukan tempat menaruh secret produksi. |
| `.gitignore` | Mencegah `.dev.vars`, `.wrangler/`, dan `node_modules/` ikut dimasukkan ke Git. |
| `CHANGELOG.md` | Catatan perubahan penting aplikasi. |
| `package.json` | Nama package, skrip npm, dan dependensi pengembangan Wrangler. |
| `package-lock.json` | Mengunci versi dependensi npm agar instalasi dapat diulang. Jangan mengedit versi paket secara manual di file ini. |
| `wrangler.toml` | Nama project Pages, folder website (`src`), tanggal kompatibilitas runtime, dan binding database D1 `DB`. |
| `README.md` | Ringkasan teknologi, konfigurasi, dan petunjuk menjalankan proyek. |
| `PANDUAN-ARSITEKTUR.md` | Penjelasan arsitektur, alur data, fitur, dan gambaran fungsi beberapa file. |
| `worker.js` | Handler server utama: autentikasi, sesi, produk, transaksi, Smart Insight, dan akses D1. |
| `docs/arsitektur.md` | Ringkasan komponen sistem, autentikasi, dan alur transaksi. |
| `docs/database.md` | Penjelasan tabel database, urutan migrasi, dan formula transaksi. |
| `docs/fitur.md` | Daftar kemampuan yang disediakan aplikasi. |
| `docs/kebutuhan-sistem.md` | Kebutuhan layanan, browser, secret, dan batas unggah foto. |
| `docs/panduan-pengguna.md` | Cara memakai login, profil, katalog, transaksi, rekap, dan Smart Insight. |
| `Note/penjelasan.md` | Panduan teknis dan inventaris proyek yang sedang dibaca ini. |
| `Note/info penting.md` | Catatan utama tentang menjalankan lokal, Pages Functions, database D1, ID, dan alamat website. |

### Route API dan migrasi

| File | Kegunaan |
|---|---|
| `functions/api/auth/login.js` | Adapter endpoint login ke handler `worker.js`. |
| `functions/api/auth/logout.js` | Adapter endpoint keluar dan penghapusan cookie. |
| `functions/api/auth/profile.js` | Adapter baca/perbarui profil. |
| `functions/api/auth/session.js` | Adapter pemeriksaan sesi. |
| `functions/api/auth/signup.js` | Adapter pendaftaran usaha. |
| `functions/api/products.js` | Adapter daftar dan tambah produk. |
| `functions/api/products/[code].js` | Adapter produk dengan kode dinamis untuk ubah/hapus. |
| `functions/api/transactions.js` | Adapter baca riwayat dan buat transaksi. |
| `functions/api/smart-insight.js` | Adapter permintaan insight. |
| `migrations/0001_initial.sql` | Membuat tabel awal produk, transaksi, item transaksi, dan indeks. |
| `migrations/0002_seed_products.sql` | Mengisi katalog contoh pertama kali. |
| `migrations/0003_owner_profile.sql` | Skema profil pemilik versi awal sebelum sistem multi-usaha. |
| `migrations/0004_multi_tenant_accounts.sql` | Membuat tabel usaha/pengguna dan memindahkan data lama agar terhubung ke usaha legacy. |
| `migrations/0005_password_encrypted.sql` | Menambah kolom password terenkripsi untuk fitur tampilan password profil. |

Route API sebagian besar hanya meneruskan `request`, `env`, dan konteks Pages ke `worker.js`. Perubahan perilaku endpoint biasanya harus dilakukan pada `worker.js`, bukan dengan menyalin aturan ke file adapter.

### Halaman browser

| File | Fungsi halaman |
|---|---|
| `src/index.html` | Halaman kasir: kamera/barcode, katalog, keranjang, pembayaran, ringkasan, dan dialog struk. |
| `src/login.html` | Form login untuk akun yang sudah terdaftar. |
| `src/signup.html` | Form pendaftaran nama usaha, pengguna, WhatsApp, dan password. |
| `src/rekap.html` | Tabel transaksi, pencarian, filter produk, dan tombol CSV. |
| `src/smart-insight.html` | Tampilan ringkasan, kartu insight, fakta transaksi, dan status konfigurasi Gemini. |
| `src/profile.html` | Tampilan serta form username, foto profil, dan penggantian password. |
| `src/panduan.html` | Petunjuk penggunaan yang dapat dibuka pengguna dari menu aplikasi. |

### JavaScript browser

| File | Tanggung jawab |
|---|---|
| `src/scripts/app.js` | Menghubungkan elemen kasir ke API: memuat data, katalog, scanner, keranjang, dialog, dan checkout. |
| `src/scripts/kasir.js` | Logika domain sisi browser untuk katalog, keranjang, subtotal/diskon/PPN, dan ringkasan. Backend tetap menghitung ulang checkout. |
| `src/scripts/auth-guard.js` | Menyembunyikan halaman privat sambil memeriksa sesi dan mengikat tombol keluar. |
| `src/scripts/image-utils.js` | Memeriksa tipe/ukuran foto dan mengompresnya ke WebP. |
| `src/scripts/login.js` | Mengirim login dan memeriksa apakah sesi sebelumnya masih aktif. |
| `src/scripts/signup.js` | Mengirim formulir pendaftaran dan memeriksa kecocokan konfirmasi password. |
| `src/scripts/navigation.js` | Mengatur buka/tutup menu, klik di luar menu, dan tombol Escape. |
| `src/scripts/profile.js` | Memuat dan menyimpan profil, foto, serta password. |
| `src/scripts/rekap.js` | Menyaring transaksi, menampilkan tabel, dan membuat unduhan CSV. |
| `src/scripts/smart-insight.js` | Meminta insight API, mengisi tampilan, dan menangani pesan/status hasil. |

Urutan pemuatan skrip dapat penting. Contohnya halaman kasir memuat `kasir.js` dan `image-utils.js` sebelum `app.js`, karena aplikasi memakai global yang disediakan oleh dua skrip tersebut.

### CSS, ikon, gambar, dan suara

| File | Kegunaan |
|---|---|
| `src/assets/css/style.css` | Tema visual, layout, komponen, dan aturan responsif semua halaman. |
| `src/icon/Favicon.png` | Ikon aplikasi di header dan tab browser. |
| `src/assets/sfx/buy.mp3` | Suara yang dicoba diputar setelah server menyimpan transaksi sukses. |
| `src/assets/images/bakwan.png` | Gambar produk bakwan. |
| `src/assets/images/biskuit.png` | Gambar produk biskuit. |
| `src/assets/images/bukutulis.png` | Gambar produk buku tulis. |
| `src/assets/images/mineral.png` | Gambar produk air mineral. |
| `src/assets/images/nasigoreng.png` | Gambar produk nasi goreng. |
| `src/assets/images/nasikuning.png` | Gambar nasi kuning yang dirujuk katalog contoh. |
| `src/assets/images/nasikuning` | File media bernama tanpa ekstensi; tidak ditemukan sebagai referensi aktif dalam sumber saat ini. Periksa sebelum mengganti atau menghapus. |
| `src/assets/images/pembalutwanita.png` | Gambar produk pembalut wanita. |
| `src/assets/images/placeholder-produk.png` | Gambar pengganti ketika produk tidak memiliki foto atau aset foto gagal dimuat. |
| `src/assets/images/popmiekari.png` | Gambar varian mi instan yang dipakai katalog contoh. |
| `src/assets/images/popmiekorea.png` | Gambar alternatif/varian mi instan; tidak ditemukan sebagai referensi aktif dalam sumber saat ini. |
| `src/assets/images/popmierawit.png` | Gambar varian mi instan yang dipakai katalog contoh. |
| `src/assets/images/pulpen.png` | Gambar produk pulpen. |
| `src/assets/images/susukotak.png` | Gambar produk susu kotak. |
| `src/assets/images/tahuisi.png` | Gambar produk tahu isi. |
| `src/assets/images/telurgulung.png` | Gambar produk telur gulung. |
| `src/assets/images/tisubasah.png` | Gambar produk tisu basah. |
| `src/assets/images/TARUH_GAMBAR_DI_SINI.txt` | Catatan penempatan gambar. Petunjuk yang disebutnya mungkin berasal dari instruksi lama, jadi gunakan folder yang tertulis pada kode sekarang. |

Gambar katalog awal juga ditentukan di `migrations/0002_seed_products.sql` dan daftar awal `MENU` pada `src/scripts/kasir.js`. Jika contoh produk atau gambar default diubah, selaraskan kedua sumber tersebut.

### Catatan dan tangkapan layar untuk pengembang

| File | Isi dan kehati-hatian |
|---|---|
| `Note/bindings.png` | Tangkapan layar konfigurasi binding/lingkungan proyek. Periksa apakah menampilkan ID akun atau informasi yang sebaiknya disamarkan sebelum dibagikan. |
| `Note/link.md` | Catatan tautan dan informasi akun proyek; **periksa dan hapus/samarkan informasi pribadi sebelum membagikan source**. File ini bukan konfigurasi yang dibutuhkan aplikasi. |
| `Note/bug/bug lagi.png` | Tangkapan layar catatan masalah tampilan. |
| `Note/bug/bug password.png` | Tangkapan layar catatan masalah password. |
| `Note/bug/bug search.jpeg` | Tangkapan layar catatan masalah pencarian. |
| `Note/bug/WhatsApp Image 2026-11-20 at 14.12.47.jpeg` | Tangkapan layar referensi yang diterima melalui WhatsApp. |
| `Note/bug/WhatsApp Image 2026-11-20 at 14.12.48.jpeg` | Tangkapan layar referensi yang diterima melalui WhatsApp. |
| `Note/bug/WhatsApp Image 2026-11-20 at 14.12.49.jpeg` | Tangkapan layar referensi yang diterima melalui WhatsApp. |

`Note/aktivitas.md`, `Note/log.md`, dan `Note/Proposal STEAMPreneur SMKN 6 KDI Tahun 2026.pdf` adalah catatan/proposal pendukung, bukan file runtime aplikasi. Folder `Note/` bukan bagian yang diperlukan server untuk berjalan. Tinjau isi catatan, proposal, `Note/link.md`, dan tangkapan layar karena mungkin memuat identitas, akun, atau data pribadi.

## 6. File/folder yang tidak perlu dikirim sebagai source

Folder proyek saat ini juga dapat berisi file hasil instalasi dan state lokal yang tidak masuk ke inventaris source di atas:

- `node_modules/`: paket yang diunduh npm. Dapat dibuat ulang dengan `npm install`; biasanya besar dan bukan kode aplikasi.
- `.wrangler/` di folder aplikasi: cache dan state lokal Wrangler; berisi database D1 lokal dan data pengembangan yang mungkin sensitif. Jangan ikut dikirim.
- Folder `.wrangler/` pada workspace induk: cache Wrangler tingkat induk, termasuk metadata akun lokal. Jangan ikut dikirim.
- `.dev.vars`: file lokal untuk secret. File ini diabaikan Git dan tidak ada sebagai file contoh yang aman untuk dibagikan.
- File `.sqlite`, `.sqlite-wal`, `.sqlite-shm`, log, cache, dan berkas temporer: data lokal/hasil proses, bukan source.

Di workspace induk (satu tingkat di atas `kasir bisa web/`) juga ada konfigurasi tooling `.github/modernize/java-upgrade/`. Folder tersebut berisi `.gitignore` dan skrip hook `hooks/scripts/recordToolUse.ps1` serta `hooks/scripts/recordToolUse.sh`; file-file itu bukan bagian aplikasi kasir. Folder `.wrangler/cache/` di workspace induk memiliki `wrangler-account.json`, yaitu metadata akun lokal. Berkas tooling dan cache induk tidak diperlukan untuk menjalankan Kasir Bisa Web; jangan ikutkan cache `.wrangler` atau informasi akun.

## 7. Bantuan AI untuk perubahan berikutnya

Saat meminta AI membantu, sertakan nama fitur dan gejala yang terlihat, langkah untuk mengulanginya, hasil yang diharapkan, serta browser/perangkat bila relevan. Minta AI untuk:

1. Membaca halaman, skrip, endpoint, handler `worker.js`, dan migrasi yang terkait sebelum mengedit.
2. Mengikuti pola proyek HTML/CSS/JavaScript biasa dan menjaga teks antarmuka tetap berbahasa Indonesia.
3. Mempertahankan validasi server dan pemisahan data berdasarkan usaha; validasi browser bukan pengganti validasi server.
4. Membuat migrasi baru jika skema D1 berubah, dan memperbarui dokumentasi bila perilaku pengguna berubah.
5. Menjalankan pemeriksaan sintaks JavaScript serta `npm run build`; uji manual alur yang berubah karena proyek belum mempunyai test runner otomatis.
6. Tidak mencetak, menyalin, atau meminta nilai secret, data login, isi database lokal, maupun informasi akun dari file lokal.

Untuk masalah checkout, mulai dari alur `src/index.html` → `src/scripts/app.js` → `functions/api/transactions.js` → `worker.js` → tabel transaksi di migrasi. Untuk masalah tampilan, telusuri HTML, ID elemen, skrip yang memasang event, lalu selector terkait di `src/assets/css/style.css`.
