# Panduan Arsitektur dan Kode Kasir Bisa Web

Dokumen ini menjelaskan bentuk proyek, fungsi folder dan file penting, cara data bergerak, serta fungsi fungsi utama di dalam kode. Penjelasannya dibuat untuk membantu pemilik proyek memahami dan mempresentasikan aplikasi, bukan mengharuskan pembaca menguasai pemrograman.

> Panduan ini mengikuti kode dan konfigurasi yang ada saat diperiksa. Jika kode atau layanan Cloudflare berubah, isi panduan perlu diperbarui juga.

## 1. Gambaran paling sederhana

Kasir Bisa Web terdiri dari empat bagian:

1. **Halaman website** yang dibuka pengguna di browser.
2. **API** yang menerima permintaan dari halaman, misalnya untuk login, membaca produk, atau menyimpan transaksi.
3. **Logika server** yang memeriksa permintaan dan menghitung transaksi.
4. **Database D1** yang menyimpan akun, usaha, produk, stok, dan transaksi.

Analogi sederhananya: halaman web adalah meja kasir yang dilihat pengguna; API adalah jalur untuk mengirim pekerjaan ke bagian belakang; `worker.js` adalah petugas yang memeriksa dan mengerjakan permintaan; D1 adalah lemari arsip tempat data disimpan.

```text
Pengguna
   |
   v
Browser: HTML + CSS + JavaScript dari src/
   |
   | fetch("/api/...")
   v
Cloudflare Pages Functions: functions/api/
   |
   | meneruskan permintaan
   v
worker.js: autentikasi, aturan, validasi, dan akses data
   |                                      |
   v                                      v
Cloudflare D1                         Gemini API (opsional)
akun, usaha, produk,                  hanya untuk penulisan
stok, transaksi                       analisis Smart Insight
```

Website memakai HTML, CSS, dan JavaScript biasa; tidak memakai framework frontend seperti React. Cloudflare Pages menyajikan halaman dan menjalankan endpoint API. Database yang dipakai aplikasi adalah Cloudflare D1.

## 2. Mengapa file dibagi seperti ini?

Pemisahan ini membuat tiap bagian memiliki tugas yang lebih jelas:

- File di `src/` mengatur tampilan dan interaksi di browser.
- File di `functions/api/` menjadi pintu masuk endpoint API Cloudflare Pages.
- `worker.js` menyimpan aturan server utama agar tidak perlu menyalin logika yang sama ke setiap endpoint.
- File SQL di `migrations/` mengatur perubahan struktur database secara berurutan.
- `docs/` menjelaskan fitur, data, dan cara penggunaan.

File endpoint di `functions/api/` terlihat berulang karena kebanyakan hanya meneruskan request ke `worker.js`. Logika yang menentukan hasil API tetap berada di satu tempat, yaitu `worker.js`.

## 3. Peta folder dan file

```text
kasir bisa web/
├── src/                         Halaman dan aset yang dikirim ke browser
│   ├── index.html               Halaman kasir
│   ├── login.html               Halaman login
│   ├── signup.html              Halaman pendaftaran usaha
│   ├── rekap.html               Halaman rekap transaksi
│   ├── smart-insight.html       Halaman analisis penjualan
│   ├── profile.html             Halaman pengaturan profil
│   ├── panduan.html             Panduan di dalam aplikasi
│   ├── scripts/                 JavaScript browser
│   └── assets/                  CSS, gambar produk, dan suara
├── functions/api/               Pintu masuk URL API Cloudflare Pages
├── worker.js                    Logika utama API dan akses database
├── migrations/                  Perubahan skema dan data awal database
├── docs/                        Dokumentasi fitur dan rancangan
├── package.json                 Perintah proyek dan dependensi pengembangan
├── package-lock.json            Versi dependensi yang dikunci npm
├── wrangler.toml                Konfigurasi Cloudflare/Wrangler
├── .dev.vars.example            Contoh variabel rahasia untuk pengembangan lokal
├── .gitignore                   Daftar file lokal yang tidak perlu disimpan di Git
├── README.md                    Ringkasan dan petunjuk menjalankan proyek
└── CHANGELOG.md                 Catatan perubahan aplikasi
```

### Folder `src/`

Folder ini berisi antarmuka website. Halaman HTML mengatur struktur halaman; file CSS mengatur warna, jarak, ukuran, dan tampilan responsif; JavaScript mengatur interaksi dan komunikasi dengan API.

| File/folder | Kegunaan |
|---|---|
| [`src/index.html`](./src/index.html) | Halaman utama kasir: katalog, keranjang, pembayaran, pemindai barcode, dan konfirmasi/struk. |
| [`src/login.html`](./src/login.html) | Form untuk pengguna yang sudah memiliki akun. |
| [`src/signup.html`](./src/signup.html) | Form membuat akun dan usaha baru. |
| [`src/rekap.html`](./src/rekap.html) | Tabel riwayat transaksi, pencarian, filter produk, dan unduh CSV. |
| [`src/smart-insight.html`](./src/smart-insight.html) | Tampilan ringkasan penjualan, stok, produk terlaris, dan saran. |
| [`src/profile.html`](./src/profile.html) | Pengaturan username, password, dan foto profil. |
| [`src/panduan.html`](./src/panduan.html) | Petunjuk penggunaan yang dapat dibuka dari menu website. |
| [`src/assets/css/style.css`](./src/assets/css/style.css) | Gaya visual bersama untuk halaman-halaman web. |
| `src/assets/images/` | Gambar produk yang digunakan katalog dan data produk awal. Contohnya `bakwan.png`, `mineral.png`, `nasigoreng.png`, `nasikuning.png`, `popmiekari.png`, `pulpen.png`, dan `tahuisi.png`. |
| `src/assets/sfx/buy.mp3` | Suara notifikasi setelah pembayaran berhasil. |
| `src/scripts/` | Logika interaksi browser; tugas setiap file dijelaskan pada bagian 6. |

### Folder `functions/api/`

Cloudflare Pages menggunakan nama dan lokasi file di folder ini untuk membentuk alamat API. Contohnya, `functions/api/auth/login.js` menjadi endpoint `/api/auth/login`. File-file ini mengekspor `onRequest`, kemudian mengirim `request`, `env`, dan konteks Cloudflare kepada `worker.js`.

| File | Endpoint yang dilayani |
|---|---|
| [`functions/api/auth/signup.js`](./functions/api/auth/signup.js) | `/api/auth/signup` |
| [`functions/api/auth/login.js`](./functions/api/auth/login.js) | `/api/auth/login` |
| [`functions/api/auth/logout.js`](./functions/api/auth/logout.js) | `/api/auth/logout` |
| [`functions/api/auth/session.js`](./functions/api/auth/session.js) | `/api/auth/session` |
| [`functions/api/auth/profile.js`](./functions/api/auth/profile.js) | `/api/auth/profile` |
| [`functions/api/products.js`](./functions/api/products.js) | `/api/products` |
| [`functions/api/products/[code].js`](./functions/api/products/%5Bcode%5D.js) | `/api/products/{kode-produk}` |
| [`functions/api/transactions.js`](./functions/api/transactions.js) | `/api/transactions` |
| [`functions/api/smart-insight.js`](./functions/api/smart-insight.js) | `/api/smart-insight` |

Nama file `[code].js` memakai pola parameter dinamis: bagian URL tersebut diisi kode produk, misalnya `/api/products/K01`.

### File penting di root

| File | Kegunaan |
|---|---|
| [`worker.js`](./worker.js) | Server utama: autentikasi, produk, transaksi, Smart Insight, dan pengarah semua request API. |
| [`migrations/`](./migrations/) | SQL untuk membuat dan memperbarui tabel database. |
| [`package.json`](./package.json) | Daftar perintah `npm run ...`, termasuk menjalankan server lokal, deploy langsung, dan migrasi D1. |
| [`package-lock.json`](./package-lock.json) | Mengunci versi paket npm agar instalasi pengembangan konsisten. |
| [`wrangler.toml`](./wrangler.toml) | Mengatur project Pages, folder hasil website, tanggal kompatibilitas runtime, dan binding D1 bernama `DB`. |
| [`.dev.vars.example`](./.dev.vars.example) | Contoh nama variabel lokal seperti `AUTH_SESSION_SECRET` dan `GEMINI_API_KEY`; bukan tempat menaruh secret produksi. |
| [`.gitignore`](./.gitignore) | Mengabaikan `.dev.vars`, `.wrangler/`, dan `node_modules/` dari Git. |
| [`README.md`](./README.md) | Ringkasan proyek, teknologi, dan perintah umum. |
| [`CHANGELOG.md`](./CHANGELOG.md) | Catatan perubahan fitur yang penting. |

`node_modules/` adalah paket yang dipasang oleh npm, bukan kode fitur aplikasi. `.wrangler/` berisi keadaan/cache pengembangan lokal yang dapat dibuat oleh Wrangler. Keduanya tidak perlu diedit sebagai bagian dari fitur.

## 4. Apa yang terjadi saat pengguna memakai aplikasi?

### Membuka halaman privat

1. Browser membuka halaman seperti Kasir, Rekap, Profil, atau Smart Insight.
2. `auth-guard.js` meminta `/api/auth/session`.
3. Server memeriksa cookie sesi. Jika sesi tidak sah atau kedaluwarsa, browser diarahkan ke halaman login.
4. Jika sah, halaman menampilkan isinya dan mengaktifkan tombol Keluar.

### Membuat akun

1. Pengguna mengisi nama usaha, username, nomor WhatsApp, dan password di halaman Daftar.
2. `signup.js` memeriksa konfirmasi password, lalu mengirim data ke `/api/auth/signup`.
3. Route Pages meneruskan permintaan ke `authApi()` di `worker.js`.
4. Server memvalidasi data, memeriksa username/WhatsApp duplikat, membuat usaha dan akun di D1, lalu mengirim cookie sesi.
5. Browser berpindah ke halaman kasir.

### Menyelesaikan transaksi

1. `app.js` menampilkan produk yang dimuat dari `/api/products`.
2. Pengguna menambahkan barang ke keranjang. `kasir.js` membantu mengelola keranjang dan menghitung perkiraan total di browser.
3. Saat konfirmasi, browser mengirim kode produk, jumlah, status member, dan uang yang dibayar ke `/api/transactions`.
4. Server mengambil harga dan stok sebenarnya dari D1, memeriksa stok, lalu menghitung ulang subtotal, diskon, PPN, total, dan kembalian.
5. Server menyimpan transaksi, rincian item, dan pengurangan stok dalam satu batch database.
6. Setelah server menyatakan transaksi berhasil, browser mengosongkan keranjang, memuat ulang data, dan mencoba memutar suara notifikasi.

Perhitungan di browser membantu menampilkan informasi dengan cepat, tetapi server tetap menghitung ulang transaksi sebelum menyimpan. Dengan demikian, harga atau total yang dikirim browser tidak menjadi sumber kebenaran untuk penyimpanan.

### Membuka rekap dan Smart Insight

- Halaman Rekap membaca `/api/transactions`, lalu melakukan pencarian/filter di browser. Ekspor CSV memakai data hasil filter yang sedang ditampilkan.
- Halaman Smart Insight mengirim permintaan ke `/api/smart-insight`. Server menghitung fakta dari D1. Jika secret `GEMINI_API_KEY` tersedia, fakta dapat dikirim ke Gemini untuk dibuatkan narasi; jika tidak, server tetap dapat mengembalikan ringkasan dasar.

## 5. Endpoint API

Semua endpoint selain proses autentikasi memerlukan sesi login yang valid.

| Metode dan URL | Tujuan |
|---|---|
| `POST /api/auth/signup` | Membuat usaha dan akun baru, lalu memulai sesi. |
| `POST /api/auth/login` | Memeriksa username atau nomor WhatsApp beserta password. |
| `POST /api/auth/logout` | Menghapus cookie sesi dari browser. |
| `GET /api/auth/session` | Memeriksa apakah pengguna masih login. |
| `GET /api/auth/profile` | Membaca profil pengguna yang sedang login. |
| `PUT /api/auth/profile` | Mengubah username, password, atau foto profil. |
| `GET /api/products` | Membaca katalog usaha yang sedang login. |
| `POST /api/products` | Menambahkan produk. |
| `PUT /api/products/{kode}` | Mengubah produk tertentu. |
| `DELETE /api/products/{kode}` | Menghapus produk tertentu. |
| `GET /api/transactions` | Membaca riwayat transaksi usaha yang sedang login. |
| `POST /api/transactions` | Memvalidasi dan menyimpan transaksi baru serta mengurangi stok. |
| `POST /api/smart-insight` | Menghitung fakta penjualan dan membuat insight dasar/opsional Gemini. |

## 6. Fungsi JavaScript browser

Di sini kata **fungsi** berarti kumpulan instruksi yang melakukan pekerjaan tertentu. Sebagian besar kode proyek menggunakan fungsi JavaScript biasa, bukan method di dalam class. Istilah “method” sering dipakai secara umum untuk menyebut fungsi seperti ini.

### `src/scripts/kasir.js` — aturan katalog dan perhitungan kasir

File ini membungkus logika kasir dalam `KasirLogic`, supaya `app.js` dapat memanggil fungsi bisnis tanpa mencampur semuanya dengan kode tampilan. Daftar `MENU` berisi data contoh awal di memori browser; ketika pemuatan API berhasil, `gantiProduk()` menggantinya dengan data server. Data permanen tetap berada di D1.

| Fungsi | Kegunaan |
|---|---|
| `cariProduk(kode)` | Mencari produk dari kode atau ID. |
| `cariProdukByBarcode(barcode)` | Mencari produk dari barcode yang dipindai/ditulis. |
| `daftarProduk()` | Mengambil daftar produk yang sedang ada di memori browser. |
| `gantiProduk(produk)` | Mengganti daftar produk di memori dengan data baru dari server. |
| `simpanProduk(produk)` | Membuat atau mengubah produk pada daftar dalam memori; penyimpanan permanen dilakukan melalui API. |
| `hapusProduk(kode)` | Menghapus produk dari daftar dalam memori. Penghapusan permanen dilakukan melalui API. |
| `saringProduk(produk, kataKunci, kategori)` | Memfilter katalog berdasarkan nama dan kategori. |
| `validasiJumlah(qty)` | Memastikan jumlah barang berupa bilangan bulat 1–99. |
| `tambahItem(keranjang, kode, qty)` | Menambahkan produk ke keranjang atau menambah jumlah produk yang sudah ada. |
| `ubahJumlah(keranjang, kode, qty)` | Mengubah jumlah satu barang dalam keranjang. |
| `hapusItem(keranjang, kode)` | Menghapus barang dari keranjang. |
| `hitungSubtotal(keranjang)` | Menjumlahkan harga dikali jumlah untuk semua item. |
| `hitungDiskon(subtotal, member)` | Menghitung diskon member atau diskon non-member sesuai aturan aplikasi. |
| `hitungPPN(dasarPajak)` | Menghitung PPN 11%. |
| `hitungRingkasan(keranjang, member)` | Menghasilkan subtotal, diskon, PPN, dan total. |
| `hitungKembalian(total, dibayar)` | Memastikan pembayaran cukup dan menghitung kembalian. |
| `buatTransaksi(...)` | Menyiapkan ringkasan transaksi untuk ditinjau sebelum dikirim ke server. |
| `hitungRingkasanPenjualan(transaksi)` | Menjumlahkan transaksi, penjualan, dan kuantitas barang untuk ringkasan halaman kasir. |
| `nominalPembayaranCepat(total)` | Membuat pilihan tombol pembayaran cepat berdasarkan total. |

### `src/scripts/app.js` — interaksi halaman kasir

File ini menghubungkan elemen HTML dengan `KasirLogic` dan API. Variabel seperti `keranjang` dan `transaksiMenunggu` hanya menyimpan keadaan sementara di browser; penyimpanan permanen dilakukan oleh server.

| Fungsi | Kegunaan |
|---|---|
| `rupiah(angka)` | Memformat angka menjadi tampilan Rupiah. |
| `elemen(tag, className, teks)` | Membuat elemen HTML dengan class dan teks tertentu. |
| `tampilkanPesan(teks, jenis)` | Menampilkan pesan berhasil atau gagal di halaman. |
| `isiKategori()` | Mengisi pilihan filter kategori dari produk yang tersedia. |
| `tampilkanPratinjauGambar(gambar)` | Menampilkan atau menyembunyikan pratinjau foto produk. |
| `renderProduk()` | Menggambar ulang kartu katalog dan tombol produk. |
| `renderKeranjang()` | Menggambar keranjang serta ringkasan subtotal, diskon, PPN, dan total. |
| `renderNominalCepat(total)` | Menggambar tombol nominal pembayaran cepat. |
| `renderPembayaran()` | Memperbarui kembalian dan status tombol pembayaran. |
| `renderRiwayat()` | Menampilkan ringkasan dan beberapa transaksi terakhir di halaman kasir. |
| `render()` | Memanggil fungsi render produk, keranjang, pembayaran, dan riwayat. |
| `isiRincian(target, transaksi)` | Menampilkan rincian transaksi pada dialog konfirmasi atau struk. |
| `putarSuaraTransaksiSukses()` | Mencoba memutar suara setelah server menyimpan transaksi. |
| `requestApi(url, options)` | Membuat request JSON, menangani respons gagal dan sesi yang sudah tidak sah. |
| `muatProduk()` | Mengambil katalog dari server dan memperbarui daftar browser. |
| `muatTransaksi()` | Mengambil riwayat transaksi dari server. |
| `bukaDialogProduk(kode)` | Membuka form untuk menambah produk atau mengedit produk yang dipilih. |
| `hapusProduk(kode)` | Meminta konfirmasi, mengirim penghapusan ke server, lalu memuat ulang katalog. |
| `nyalakanKamera()` | Meminta izin kamera dan memulai pemindaian barcode jika browser mendukungnya. |
| `matikanKamera()` | Menghentikan aliran kamera dan pemindaian. |
| `pindaiFrame()` | Memeriksa frame kamera secara berulang untuk mencari barcode. |
| `prosesBarcode(barcode)` | Mencari produk dari barcode, memasukkannya ke keranjang, atau membuka form produk baru. |
| `ajukanPembayaran()` | Memvalidasi keranjang/pembayaran dan membuka dialog konfirmasi. |
| `konfirmasiPembayaran()` | Mengirim transaksi ke server; jika sukses, menampilkan struk dan memperbarui produk serta riwayat. |

Di bagian akhir file, event listener menghubungkan klik tombol, pencarian, filter, form produk, input barcode, dan konfirmasi pembayaran ke fungsi-fungsi tersebut.

### File JavaScript browser lainnya

| File dan fungsi | Kegunaan |
|---|---|
| [`src/scripts/login.js`](./src/scripts/login.js): `showMessage()` | Menampilkan status atau kesalahan pada halaman login. |
| `login.js`: `checkExistingSession()` | Memeriksa sesi lama; jika masih aktif, langsung membuka halaman kasir. |
| `login.js`: submit form | Mengirim username/WhatsApp dan password ke endpoint login. |
| [`src/scripts/signup.js`](./src/scripts/signup.js): `showMessage()` | Menampilkan status pendaftaran. |
| `signup.js`: submit form | Memeriksa kecocokan password, mengirim data akun/usaha, lalu membuka kasir jika berhasil. |
| [`src/scripts/auth-guard.js`](./src/scripts/auth-guard.js) | Memeriksa sesi di halaman privat, mengarahkan pengguna yang belum login ke login, dan menangani tombol Keluar. |
| [`src/scripts/navigation.js`](./src/scripts/navigation.js): `setMenuOpen(open)` | Membuka/menutup menu navigasi dan memperbarui atribut aksesibilitas. Listener-nya juga menutup menu saat klik di luar, memilih tautan, atau menekan Escape. |
| [`src/scripts/image-utils.js`](./src/scripts/image-utils.js): `blobKeDataUrl(blob)` | Mengubah hasil foto yang sudah diproses menjadi format data URL agar dapat dikirim ke API. |
| `image-utils.js`: `kompresKeWebp(file)` | Memeriksa format dan ukuran file, mengecilkan gambar, lalu mengompresnya ke WebP. Dipakai untuk foto produk dan profil. |
| [`src/scripts/profile.js`](./src/scripts/profile.js): `setProfileStatus()` | Menampilkan status penyimpanan profil. |
| `profile.js`: `renderProfileImage()` | Menampilkan foto profil atau inisial pengguna. |
| `profile.js`: `loadProfile()` | Meminta data profil ke server dan mengisi form. Submit form mengirim perubahan; listener foto menangani kompresi/penghapusan foto. |
| [`src/scripts/rekap.js`](./src/scripts/rekap.js): `rupiah()` | Memformat nilai uang. |
| `rekap.js`: `saringTransaksi()` | Memfilter transaksi berdasarkan teks dan nama produk. |
| `rekap.js`: `transaksiYangDapatDiekspor()`, `transaksiTerlihat()` | Menentukan transaksi yang ditampilkan/diekspor mengikuti filter saat ini. |
| `rekap.js`: `bisaUnduhCsv()` | Menentukan apakah tombol unduh CSV dapat digunakan. |
| `rekap.js`: `isiPilihanProduk()` | Mengisi filter dengan nama produk yang pernah terjual. |
| `rekap.js`: `tampilkanPesan()` | Menampilkan pesan dalam tabel jika data kosong atau gagal dimuat. |
| `rekap.js`: `renderRekap()` | Menggambar baris-baris transaksi pada tabel. |
| `rekap.js`: `selCsv()` | Mengutip dan mengamankan nilai sel CSV, termasuk nilai yang dapat dianggap formula spreadsheet. |
| `rekap.js`: `buatCsv()` | Membentuk isi file CSV dari daftar transaksi. |
| `rekap.js`: `unduhCsv()` | Membuat unduhan CSV di browser. |
| `rekap.js`: `mulaiRekap()` | Mengambil data transaksi, memasang listener filter/reset/unduh, dan merender halaman. |
| [`src/scripts/smart-insight.js`](./src/scripts/smart-insight.js): `rupiah()` | Memformat nilai penjualan. |
| `smart-insight.js`: `setNotice()` | Menampilkan status proses insight. |
| `smart-insight.js`: `generateInsight()` | Meminta insight dari API dan mengisi hasil serta kartu ringkasan di halaman. |
| `smart-insight.js`: `escapeHtml()` | Mengubah teks menjadi teks aman sebelum dimasukkan ke area HTML ringkasan. |

## 7. Fungsi utama di `worker.js`

### Format respons dan konfigurasi autentikasi

| Fungsi/konstanta | Kegunaan |
|---|---|
| `json(data, status, extraHeaders)` | Membuat respons JSON dengan header larangan cache. |
| `sessionSecretConfigured(env)` | Memastikan secret sesi tersedia dan memenuhi panjang minimum. |
| `bootstrapCredentialsConfigured(env)` | Memeriksa apakah kredensial opsional untuk akun lama tersedia dan valid. |
| `USER_SELECT` | Potongan query bersama untuk mengambil akun beserta nama usahanya. |

### Password dan sesi

| Fungsi | Kegunaan |
|---|---|
| `derivePasswordHash(password, salt, iterations)` | Menghasilkan hash password dengan PBKDF2-SHA-256. |
| `hashPassword(password)` | Membuat salt acak dan hash password untuk disimpan; password asli tidak disimpan. |
| `verifyPassword(password, profile)` | Memeriksa kecocokan password terhadap hash tersimpan. |
| `getUserById(env, id)` | Mengambil akun berdasarkan ID. |
| `getOrCreateLegacyUser(env)` | Mengambil akun legacy lama atau membuatnya dari secret bootstrap jika memang diperlukan. |
| `bytesToBase64Url(bytes)` / `base64UrlToBytes(value)` | Mengubah data biner ke/dari format teks Base64 URL-safe untuk hash dan token. |
| `createSessionToken(secret, userId, sessionVersion)` | Membuat token sesi bertanda tangan yang berlaku 12 jam. |
| `getSessionUser(request, env)` | Membaca cookie, memeriksa tanda tangan/masa berlaku/versi sesi, lalu mengembalikan akun yang sah. |
| `cookieHeaders(request, token, maxAge)` | Membentuk cookie sesi dengan atribut keamanan seperti `HttpOnly` dan `SameSite`. |
| `parseJsonBody(request)` | Membaca JSON request dan menolak bentuk data yang bukan objek. |
| `authApi(request, env, pathname)` | Menangani endpoint signup, login, logout, pemeriksaan sesi, dan profil. |

`session_version` membuat sesi lama dapat dibatalkan. Ketika username atau password diubah, versi sesi naik sehingga sesi pada perangkat lain tidak lagi valid; server memberikan cookie baru untuk sesi perangkat yang sedang dipakai.

### Produk dan transaksi

| Fungsi | Kegunaan |
|---|---|
| `validProductImage(image)` | Memeriksa format dan batas ukuran data foto WebP. |
| `rupiah(value)` | Membentuk teks nilai Rupiah untuk insight server. |
| `getProducts(env, businessId)` | Mengambil katalog hanya untuk ID usaha yang sedang login. |
| `getTransactions(env, businessId)` | Mengambil transaksi usaha beserta rincian itemnya. |
| `productsApi(request, env, pathname, businessId)` | Menangani baca, tambah, ubah, dan hapus produk; memeriksa barcode, harga, stok, dan foto. |
| `transactionsApi(request, env, businessId)` | Membaca transaksi atau memvalidasi dan menyimpan transaksi baru serta pengurangan stok. |

`businessId` berasal dari akun pada sesi yang sudah diverifikasi server, bukan dipercaya dari data yang dikirim browser. Inilah bagian penting dari pemisahan data antarusaha.

### Smart Insight dan pengarah request

| Fungsi | Kegunaan |
|---|---|
| `parseGeminiJson(text)` | Mencoba membaca keluaran teks Gemini sebagai JSON. |
| `smartInsightApi(env, businessId)` | Menghitung fakta penjualan/stok dari D1, membuat hasil dasar, dan bila tersedia meminta narasi opsional ke Gemini. |
| `export default.fetch(request, env, context)` | Pintu utama backend. Mengarahkan request autentikasi ke `authApi`, memeriksa sesi untuk API privat, memilih handler endpoint, dan menyajikan aset statis untuk request halaman. |

## 8. Data yang disimpan di database

Database diakses oleh server melalui binding bernama `DB`, yang dikonfigurasi di Wrangler/Cloudflare. Tabel utamanya:

| Tabel | Isinya |
|---|---|
| `businesses` | Nama dan identitas usaha. |
| `users` | Akun, hubungan ke usaha, username, WhatsApp, hash/salt password, foto profil, dan versi sesi. |
| `products` | Produk, barcode, harga, stok, kategori, foto, dan ID usaha pemilik. |
| `transactions` | Ringkasan transaksi, waktu, nilai pembayaran, diskon, pajak, total, dan ID usaha. |
| `transaction_items` | Barang-barang dalam transaksi, termasuk nama/harga saat transaksi dan jumlahnya. |

Relasi sederhananya:

```text
businesses 1 ─── banyak users
businesses 1 ─── banyak products
businesses 1 ─── banyak transactions
transactions 1 ─── banyak transaction_items
```

Setiap produk dan transaksi memiliki `business_id`. Query server membatasi pembacaan/perubahan berdasarkan usaha dari sesi, agar satu akun tidak membuka data usaha lain.

### Aturan hitung transaksi

- Member mendapat diskon 10% dari subtotal.
- Non-member mendapat diskon 5% jika subtotal minimal Rp100.000.
- PPN 11% dihitung setelah diskon.
- Stok berkurang setelah server memvalidasi dan menyimpan transaksi.

## 9. Apa fungsi file migrasi?

Migrasi adalah perubahan database yang diberi nomor dan diterapkan berurutan. Migrasi bukan halaman website dan bukan proses deploy kode.

| File | Perubahan utama |
|---|---|
| [`migrations/0001_initial.sql`](./migrations/0001_initial.sql) | Membuat tabel awal produk, transaksi, dan item transaksi beserta indeks. |
| [`migrations/0002_seed_products.sql`](./migrations/0002_seed_products.sql) | Memasukkan produk contoh awal. |
| [`migrations/0003_owner_profile.sql`](./migrations/0003_owner_profile.sql) | Menambahkan tabel profil pemilik untuk format autentikasi lama. |
| [`migrations/0004_multi_tenant_accounts.sql`](./migrations/0004_multi_tenant_accounts.sql) | Menambahkan tabel usaha dan pengguna, menghubungkan data lama ke usaha legacy, dan mengubah produk/transaksi agar dipisahkan per usaha. |

Migrasi database perlu dijalankan pada database yang benar sebelum fitur yang membutuhkan tabel baru dipakai. Menjalankan migrasi ke D1 yang salah tidak memperbaiki database produksi yang sedang digunakan.

## 10. Konfigurasi, GitHub, dan Wrangler

`wrangler.toml` mengatur project Cloudflare Pages dan binding database. `package.json` menyediakan perintah seperti:

- `npm run dev` — menjalankan Pages secara lokal melalui Wrangler.
- `npm run build` — pemeriksaan sederhana; proyek tidak memiliki langkah kompilasi frontend.
- `npm run deploy` — mengirim folder `src` langsung ke Pages memakai Wrangler CLI.
- `npm run d1:migrate:local` — menjalankan migrasi ke D1 lokal.
- `npm run d1:migrate:remote` — menjalankan migrasi remote ke database yang dikonfigurasi Wrangler.

**Wrangler adalah alat baris perintah Cloudflare**, bukan tempat wajib untuk menulis atau mengedit kode. Jika project Pages terhubung ke GitHub untuk deploy otomatis, perubahan kode dapat dideploy oleh integrasi GitHub tersebut. Perintah `npm run deploy` adalah jalur deploy manual yang berbeda dan tidak perlu dijalankan hanya karena file Wrangler ada.

### Peringatan penting tentang target database

Catatan pemeriksaan produksi sebelumnya menemukan perbedaan target:

- D1 produksi Pages `kasirbisa` yang dipakai saat perbaikan pendaftaran: nama `kasirbisa`, ID `520d3b0f-e730-4a12-ad88-7b68afffce83`.
- [`wrangler.toml`](./wrangler.toml) saat diperiksa menunjuk D1 bernama `kasir-bisa`, ID `6676ee36-dbb3-448e-b99c-27ca0684e9fa`.
- Skrip `d1:migrate:remote` di [`package.json`](./package.json) memakai nama D1 `kasir-bisa`.

Itu dua target berbeda. Karena itu, **jangan menjalankan `npm run d1:migrate:remote` sebelum memastikan konfigurasi menunjuk database produksi yang benar**. Membaca panduan ini tidak menjalankan migrasi atau deploy apa pun. Pemeriksaan sebelumnya juga mencatat bahwa signup produksi berhasil diuji setelah migrasi; deploy GitHub tidak dilakukan sebagai bagian dari perbaikan tersebut.

### Secret

Nama variabel contoh tercantum di [`.dev.vars.example`](./.dev.vars.example):

- `AUTH_SESSION_SECRET` — secret penandatangan cookie sesi; minimal 32 karakter.
- `GEMINI_API_KEY` — opsional, untuk layanan Gemini pada Smart Insight.
- `GEMINI_MODEL` — nama model Gemini yang digunakan bila integrasi aktif.
- `KASIR_USERNAME` dan `KASIR_PASSWORD` — opsional untuk pembuatan akun lama/legacy pada kondisi tertentu.

Nilai produksi seharusnya disimpan sebagai secret di pengaturan Cloudflare, bukan ditulis ke kode atau dikirim dalam percakapan. Untuk pengembangan lokal, `.dev.vars` diabaikan Git; jangan mengunggah isinya.

## 11. Glosarium singkat

| Istilah | Arti sederhana |
|---|---|
| Frontend | Bagian website yang tampil dan digunakan di browser. |
| Backend | Bagian server yang memeriksa dan mengolah permintaan. |
| API | Jalur komunikasi antara halaman website dan server. |
| Endpoint | Satu alamat API dengan tugas tertentu, misalnya `/api/auth/login`. |
| Route adapter / `onRequest` | Penghubung endpoint Cloudflare Pages ke logika utama `worker.js`. |
| D1 | Layanan database Cloudflare yang menyimpan data aplikasi. |
| Binding `DB` | Nama penghubung yang membuat kode Worker dapat mengakses D1. |
| Migration | File SQL bernomor untuk membuat/mengubah struktur atau isi awal database. |
| Session / sesi | Bukti sementara bahwa pengguna sudah login; di aplikasi ini memakai cookie. |
| Hash password | Bentuk verifikasi satu arah; password asli tidak disimpan sebagai teks biasa. |
| Multi-tenant | Satu aplikasi digunakan banyak usaha dengan data masing-masing dipisahkan. |
| Secret | Nilai rahasia untuk autentikasi atau layanan luar; tidak boleh dipublikasikan. |
| CSV | Format tabel teks yang bisa dibuka di aplikasi spreadsheet. |

## 12. Ringkasan untuk presentasi

> “Kasir Bisa Web adalah aplikasi kasir berbasis website. Pengguna dapat mendaftar usaha dan login. Halaman website berkomunikasi dengan API di Cloudflare Pages; server memvalidasi akun dan transaksi, lalu menyimpan data ke Cloudflare D1. Data produk, stok, dan transaksi dipisahkan berdasarkan usaha. Sistem juga menyediakan rekap CSV dan Smart Insight; analisis Gemini bersifat opsional.”

Jika ditanya mengapa kodenya dibagi ke beberapa folder:

> “`src` berisi tampilan dan interaksi browser, `functions/api` adalah pintu endpoint Cloudflare, `worker.js` menangani aturan dan akses database, sedangkan `migrations` mengatur perubahan tabel. Pemisahan ini memudahkan tiap bagian dipahami dan menghindari pengulangan logika server.”

## 13. Dokumentasi terkait

- [README proyek](./README.md) — cara menjalankan proyek dan ringkasan konfigurasi.
- [Dokumentasi arsitektur ringkas](./docs/arsitektur.md) — diagram dan alur autentikasi/transaksi.
- [Dokumentasi database](./docs/database.md) — tabel dan aturan transaksi.
- [Daftar fitur](./docs/fitur.md) — kemampuan yang tersedia.
- [Kebutuhan sistem](./docs/kebutuhan-sistem.md) — layanan dan syarat penggunaan.
- [Panduan pengguna](./docs/panduan-pengguna.md) — petunjuk operasional untuk pengguna.
