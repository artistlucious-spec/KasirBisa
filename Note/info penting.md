# Informasi Penting Sebelum Menjalankan Kasir Bisa

> **Jangan buka `src/index.html` dengan klik dua kali lalu mengharapkan aplikasi berfungsi penuh.** Kasir Bisa memanggil API untuk login, produk, transaksi, dan profil. API tersebut berjalan bersama Cloudflare Pages Functions dan membutuhkan database D1.

## Apakah aplikasi wajib di-hosting?

Untuk **mencoba di komputer sendiri**, tidak perlu hosting publik. Jalankan Wrangler secara lokal; Wrangler menyiapkan server Pages/Functions dan database D1 lokal.

Untuk **dipakai melalui alamat website**, aplikasi harus di-deploy ke layanan yang menjalankan Cloudflare Pages Functions serta terhubung ke D1. Hosting file statis saja (misalnya membuka HTML langsung atau hosting statis tanpa Functions) tidak cukup. Halaman mungkin terbuka, tetapi permintaan `/api/...` akan gagal.

## Pilihan 1: mencoba lokal tanpa menyentuh database online

Jalankan dari folder utama aplikasi, `kasir bisa web/`:

```powershell
npm install
Copy-Item .dev.vars.example .dev.vars
# Isi AUTH_SESSION_SECRET di .dev.vars dengan secret lokal acak, minimal 32 karakter.
npm run d1:migrate:local
npm run dev
```

Buka alamat lokal yang dicetak Wrangler. Skrip `npm run dev` secara eksplisit membaca `.dev.vars` agar secret tersedia pada Pages Functions lokal. Jika menjalankan Wrangler secara langsung, gunakan `npx wrangler pages dev src --env-file .dev.vars`.

Data dan migrasi pada mode ini adalah untuk D1 **lokal**, bukan database online. Jangan ganti perintah `d1:migrate:local` menjadi `d1:migrate:remote` hanya untuk mencoba aplikasi.

Jika `node_modules/` sudah tersedia tetapi perintah `npm run dev` gagal karena instalasi npm di komputer bermasalah, jalankan Wrangler lokal secara langsung di PowerShell:

```powershell
.\node_modules\.bin\wrangler.cmd pages dev src --env-file .dev.vars
```

## Pilihan 2: membuat website Cloudflare sendiri

Jika guru ingin mempunyai alamat website yang berbeda, buat project Pages dan D1 di akun Cloudflare milik sendiri. Jangan mengandalkan nama database saja untuk menghubungkan aplikasi.

### Perbedaan nama project, nama database, ID, binding, dan alamat website

| Bagian | Nilai/pengaturan | Artinya |
|---|---|---|
| Nama database D1 | `kasirbisa` | Nama database yang dipakai konfigurasi dan perintah migrasi proyek ini. Database baru boleh menggunakan nama yang sama. |
| `database_id` | ID yang diberikan Cloudflare | Identitas database yang benar-benar akan diakses. ID berbeda untuk database/akun baru; ganti nilai lama di `wrangler.toml` dengan ID database milik akun baru. |
| Binding D1 | `DB` | Nama variabel yang dipakai backend sebagai `env.DB`. Pertahankan nama ini, atau kode backend juga harus diubah. |
| Nama project Pages | `kasirbisa` atau nama baru | Menentukan project tujuan deploy dan umumnya menjadi bagian dari alamat `https://nama-project.pages.dev`. |
| Alamat website | `https://nama-project.pages.dev` atau domain khusus | Alamat yang dibuka pengguna. Boleh berbeda dari nama database. Kode browser memakai URL API relatif `/api/...`, sehingga domain baru dapat berfungsi jika Pages Functions ikut ter-deploy pada site yang sama. |

**Intinya:** nama database boleh tetap `kasirbisa` sementara alamat website berbeda. Namun, `database_name` yang sama tidak otomatis menunjuk ke database yang sama. Pada akun Cloudflare lain, `database_id` harus diganti ke ID D1 yang baru. Pastikan Pages dan D1 berada pada akun Cloudflare yang sama.

### Urutan setup production

1. Buat project **Cloudflare Pages** di akun Cloudflare milik guru.
2. Buat database D1 dengan nama `kasirbisa`. Cloudflare memberikan ID database baru; salin ID itu ke `database_id` di `wrangler.toml`. Pertahankan `database_name = "kasirbisa"` dan `binding = "DB"`.
3. Pastikan Pages memakai konfigurasi D1 tersebut (binding bernama `DB`) dan memuat Functions dari folder `functions/`.
4. Atur secret `AUTH_SESSION_SECRET` di environment Pages dengan nilai rahasia acak minimal 32 karakter. Jangan menaruh secret di HTML, JavaScript, atau Git. `GEMINI_API_KEY` opsional; tanpa key, ringkasan dasar tetap tersedia.
5. Setelah memeriksa akun dan ID database sekali lagi, terapkan skema ke D1 **baru**:

   ```powershell
   npm run d1:migrate:remote
   ```

6. Deploy ke project Pages. Perintah `npm run deploy` saat ini menargetkan project dengan nama persis `kasirbisa`. Jika project Pages baru mempunyai nama lain agar alamat websitenya berbeda, ubah nama target pada skrip `deploy` di `package.json`, atau jalankan:

   ```powershell
   npx wrangler pages deploy src --project-name nama-project-baru
   ```

7. Gunakan alamat Pages yang diberikan Cloudflare. Jika memakai domain khusus, hubungkan domain itu melalui pengaturan Pages.

Jalankan migrasi remote **hanya** setelah `database_id` menunjuk ke database baru yang benar. Migrasi mengubah database yang dituju; jangan arahkan setup percobaan guru ke database produksi pemilik proyek.

## Kesalahan umum

| Gejala | Kemungkinan penyebab / pemeriksaan |
|---|---|
| Halaman terbuka dari file, tetapi login atau data gagal | File HTML langsung tidak menjalankan Pages Functions. Gunakan `npm run dev` atau deploy ke Cloudflare Pages. |
| API `/api/...` menghasilkan 404 | Site hanya meng-host file statis, atau folder `functions/` tidak ikut dipasang pada Pages. |
| Login menampilkan autentikasi belum siap | Secret `AUTH_SESSION_SECRET` belum diatur pada environment yang sedang dijalankan. |
| D1 tidak ditemukan / query gagal | Periksa `database_id`, akun Cloudflare, binding bernama `DB`, dan apakah migrasi sudah diterapkan ke database yang sama. |
| `npm run deploy` menuju project yang salah | Skrip di `package.json` menargetkan `kasirbisa`; sesuaikan dengan nama project Pages baru. |
| Website punya URL berbeda tetapi data tidak muncul | URL website bukan penentu database. Periksa binding `DB` dan `database_id` di konfigurasi Pages. |
| `npm`/`node` tidak dikenali atau npm sendiri melaporkan modul hilang | Perbaiki/instal ulang Node.js LTS, lalu tutup dan buka kembali PowerShell/VS Code. Jika `node_modules/` masih lengkap, coba perintah Wrangler langsung di atas. |

## Jangan bagikan

- Jangan kirim `.dev.vars`, API key, `AUTH_SESSION_SECRET`, password, atau token.
- Jangan sertakan folder `.wrangler/` karena dapat memuat database lokal dan state akun.
- Untuk uji coba guru, gunakan database D1 kosong milik guru, bukan database produksi pemilik aplikasi.
