let keranjang = [];
let transaksiTersimpan = [];
let transaksiMenunggu = null;
let pesanKesalahanPenyimpanan = "";
let gambarProdukPerubahan = null;
let gambarProdukDiproses = false;

const elProduk = document.getElementById("daftar-produk");
const elPencarian = document.getElementById("cari-produk");
const elKategori = document.getElementById("filter-kategori");
const elKeranjang = document.getElementById("daftar-keranjang");
const elBayar = document.getElementById("bayar");
const elMember = document.getElementById("member");
const elDialog = document.getElementById("dialog-transaksi");

function rupiah(angka) {
  return "Rp" + Number(angka).toLocaleString("id-ID");
}

function elemen(tag, className, teks) {
  const hasil = document.createElement(tag);
  if (className) hasil.className = className;
  if (teks !== undefined) hasil.textContent = teks;
  return hasil;
}

function tampilkanPesan(teks, jenis = "") {
  const pesan = document.getElementById("pesan");
  pesan.textContent = teks;
  pesan.className = "notice" + (jenis ? " " + jenis : "");
}

function isiKategori() {
  const kategori = [...new Set(KasirLogic.daftarProduk().map((produk) => produk.kategori))]
    .sort((a, b) => a.localeCompare(b, "id-ID"));
  elKategori.replaceChildren();
  elKategori.appendChild(new Option("Semua kategori", ""));
  for (const nama of kategori) elKategori.appendChild(new Option(nama, nama));
}

function tampilkanPratinjauGambar(gambar) {
  const pratinjau = document.getElementById("produk-gambar-pratinjau");
  const img = document.getElementById("produk-gambar-img");
  pratinjau.hidden = !gambar;
  if (gambar) img.src = gambar;
  else img.removeAttribute("src");
}

function blobKeDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Foto tidak dapat dibaca."));
    }, { once: true });
    reader.addEventListener("error", () => reject(new Error("Foto tidak dapat dibaca.")), { once: true });
    reader.readAsDataURL(blob);
  });
}

async function kompresFotoProduk(file) {
  const tipeDiizinkan = ["image/jpeg", "image/png", "image/webp"];
  if (!tipeDiizinkan.includes(file.type)) {
    throw new Error("Pilih foto berformat JPG, PNG, atau WebP.");
  }
  if (file.size > 12 * 1024 * 1024) {
    throw new Error("Ukuran foto asli maksimal 12 MB.");
  }

  const bitmap = await createImageBitmap(file);
  try {
    const skalaAwal = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Foto tidak dapat diproses di browser ini.");

    for (const pengaliUkuran of [1, 0.8, 0.65]) {
      canvas.width = Math.max(1, Math.round(bitmap.width * skalaAwal * pengaliUkuran));
      canvas.height = Math.max(1, Math.round(bitmap.height * skalaAwal * pengaliUkuran));
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      for (const kualitas of [0.8, 0.68, 0.55]) {
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", kualitas));
        if (!blob) throw new Error("Foto tidak dapat dikompres.");
        if (blob.size <= 100 * 1024) return await blobKeDataUrl(blob);
      }
    }
  } finally {
    bitmap.close();
  }
  throw new Error("Foto terlalu besar setelah dikompres. Coba pilih foto lain.");
}

function renderProduk() {
  const daftar = KasirLogic.saringProduk(KasirLogic.daftarProduk(), elPencarian.value, elKategori.value);
  elProduk.replaceChildren();
  document.getElementById("jumlah-produk").textContent = `${daftar.length} produk`;
  if (daftar.length === 0) {
    elProduk.appendChild(elemen("p", "empty-products", "Produk tidak ditemukan."));
    return;
  }

  for (const produk of daftar) {
    const kartu = elemen("article", "product-card");
    const gambar = document.createElement("img");
    gambar.src = produk.gambar;
    gambar.alt = produk.nama;
    gambar.loading = "lazy";
    gambar.addEventListener("error", () => {
      gambar.removeAttribute("src");
      gambar.alt = "Gambar tidak tersedia";
      gambar.classList.add("image-unavailable");
    }, { once: true });

    const info = elemen("div", "product-info");
    info.append(
      elemen("span", "product-category", produk.kategori),
      elemen("h3", "", produk.nama),
      elemen("strong", "product-price", rupiah(produk.harga)),
      elemen("span", "stock-badge", `Stok ${produk.stock ?? 0} · ${produk.barcode || "-"}`)
    );
    const tambah = elemen("button", "add-button", "Tambah");
    tambah.type = "button";
    tambah.dataset.kode = produk.kode;
    tambah.setAttribute("aria-label", `Tambah ${produk.nama} ke keranjang`);
    const aksi = elemen("div", "product-actions");
    const edit = elemen("button", "edit-product", "Edit");
    edit.type = "button";
    edit.dataset.editProduk = produk.kode;
    const hapus = elemen("button", "delete-product", "Hapus");
    hapus.type = "button";
    hapus.dataset.hapusProduk = produk.kode;
    aksi.append(edit, hapus);
    kartu.append(gambar, info, tambah, aksi);
    elProduk.appendChild(kartu);
  }
}

function renderKeranjang() {
  elKeranjang.replaceChildren();
  const kosong = keranjang.length === 0;
  document.getElementById("keranjang-kosong").hidden = !kosong;
  document.getElementById("kosongkan-keranjang").disabled = kosong;
  document.getElementById("jumlah-keranjang").textContent =
    String(keranjang.reduce((jumlah, item) => jumlah + item.qty, 0));

  for (const item of keranjang) {
    const baris = elemen("article", "cart-item");
    const gambar = document.createElement("img");
    gambar.className = "cart-item-image";
    gambar.src = item.gambar;
    gambar.alt = "";
    gambar.setAttribute("aria-hidden", "true");
    gambar.loading = "lazy";
    gambar.addEventListener("error", () => {
      gambar.hidden = true;
    }, { once: true });

    const rincian = elemen("div", "cart-item-detail");
    rincian.append(
      elemen("strong", "", item.nama),
      elemen("span", "", `${rupiah(item.harga)} × ${item.qty}`)
    );
    const kontrol = elemen("div", "quantity-controls");
    const kurang = elemen("button", "quantity-button", "−");
    kurang.type = "button";
    kurang.dataset.action = "decrease";
    kurang.dataset.kode = item.kode;
    kurang.disabled = item.qty <= 1;
    kurang.setAttribute("aria-label", `Kurangi jumlah ${item.nama}`);
    const jumlah = elemen("span", "quantity-value", String(item.qty));
    const tambah = elemen("button", "quantity-button", "+");
    tambah.type = "button";
    tambah.dataset.action = "increase";
    tambah.dataset.kode = item.kode;
    tambah.disabled = item.qty >= 99;
    tambah.setAttribute("aria-label", `Tambah jumlah ${item.nama}`);
    kontrol.append(kurang, jumlah, tambah);
    const hapus = elemen("button", "remove-button", "Hapus");
    hapus.type = "button";
    hapus.dataset.action = "remove";
    hapus.dataset.kode = item.kode;
    hapus.setAttribute("aria-label", `Hapus ${item.nama} dari keranjang`);
    baris.append(gambar, rincian, kontrol, hapus);
    elKeranjang.appendChild(baris);
  }

  const ringkasan = KasirLogic.hitungRingkasan(keranjang, elMember.checked);
  document.getElementById("subtotal").textContent = rupiah(ringkasan.subtotal);
  document.getElementById("diskon").textContent = "-" + rupiah(ringkasan.diskon);
  document.getElementById("ppn").textContent = rupiah(ringkasan.ppn);
  document.getElementById("total").textContent = rupiah(ringkasan.total);
}

function renderNominalCepat(total) {
  const pilihan = document.getElementById("nominal-cepat");
  pilihan.replaceChildren();
  for (const nominal of KasirLogic.nominalPembayaranCepat(total)) {
    const tombol = elemen("button", "quick-amount", rupiah(nominal));
    tombol.type = "button";
    tombol.dataset.nominal = nominal;
    pilihan.appendChild(tombol);
  }
}

function renderPembayaran() {
  const total = KasirLogic.hitungRingkasan(keranjang, elMember.checked).total;
  const dibayar = elBayar.value.trim() === "" ? NaN : Number(elBayar.value);
  const valid = Number.isSafeInteger(dibayar) && dibayar >= total;
  document.getElementById("kembalian").textContent =
    valid ? rupiah(dibayar - total) : rupiah(0);
  document.getElementById("tombol-bayar").disabled =
    Boolean(pesanKesalahanPenyimpanan) || keranjang.length === 0;
  renderNominalCepat(total);
}

function renderRiwayat() {
  const ringkasan = KasirLogic.hitungRingkasanPenjualan(transaksiTersimpan);
  document.getElementById("jumlah-transaksi").textContent = String(ringkasan.jumlahTransaksi);
  document.getElementById("total-penjualan").textContent = rupiah(ringkasan.totalPenjualan);
  const daftar = document.getElementById("riwayat-transaksi");
  daftar.replaceChildren();
  if (transaksiTersimpan.length === 0) {
    daftar.appendChild(elemen("p", "history-empty", "Belum ada transaksi tersimpan."));
    return;
  }
  for (const transaksi of transaksiTersimpan.slice(-5).reverse()) {
    const item = elemen("article", "history-item");
    const produk = Array.isArray(transaksi.items) ? transaksi.items : [];
    const waktu = new Date(transaksi.waktu);
    const labelWaktu = Number.isNaN(waktu.getTime()) ? "Waktu tidak tersedia" : waktu.toLocaleString("id-ID");
    const namaProduk = produk.map((barang) => `${barang.nama} × ${barang.qty}`).join(", ");
    item.append(
      elemen("div", "history-detail", `${labelWaktu} · ${namaProduk || "Rincian produk tidak tersedia"}`),
      elemen("strong", "", rupiah(transaksi.total))
    );
    daftar.appendChild(item);
  }
}

function render() {
  renderProduk();
  renderKeranjang();
  renderPembayaran();
  renderRiwayat();
}

function isiRincian(target, transaksi) {
  target.replaceChildren();
  const daftar = transaksi.items.map((item) => `${item.nama} × ${item.qty}`).join(", ");
  target.append(
    elemen("p", "", daftar),
    elemen("p", "", `Subtotal: ${rupiah(transaksi.subtotal)}`),
    elemen("p", "", `Diskon: -${rupiah(transaksi.diskon)}`),
    elemen("p", "", `PPN 11%: ${rupiah(transaksi.ppn)}`),
    elemen("p", "", `Total: ${rupiah(transaksi.total)}`),
    elemen("p", "", `Uang diterima: ${rupiah(transaksi.dibayar)}`),
    elemen("p", "", `Kembalian: ${rupiah(transaksi.kembalian)}`)
  );
}

async function requestApi(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({ error: "Respons server tidak valid" }));
  if (!response.ok) throw new Error(data.error || "Permintaan ke database gagal");
  return data;
}

async function muatProduk() {
  try {
    const produk = await requestApi("/api/products");
    if (Array.isArray(produk)) {
      KasirLogic.gantiProduk(produk);
      isiKategori();
      render();
    }
  } catch (error) {
    pesanKesalahanPenyimpanan = error.message;
    tampilkanPesan(`Database produk tidak dapat dimuat: ${error.message}`, "error");
  }
}

async function muatTransaksi() {
  try {
    const transaksi = await requestApi("/api/transactions");
    if (Array.isArray(transaksi)) {
      transaksiTersimpan = transaksi;
      pesanKesalahanPenyimpanan = "";
      render();
    }
  } catch (error) {
    pesanKesalahanPenyimpanan = error.message;
    tampilkanPesan(`Database transaksi tidak dapat dimuat: ${error.message}`, "error");
  }
}

function bukaDialogProduk(kode = "") {
  const dialog = document.getElementById("dialog-produk");
  const produk = kode ? KasirLogic.cariProduk(kode) : null;
  gambarProdukPerubahan = null;
  gambarProdukDiproses = false;
  document.getElementById("produk-gambar").value = "";
  document.getElementById("produk-gambar-status").textContent = "";
  tampilkanPratinjauGambar(produk?.gambar || "");
  document.getElementById("judul-dialog-produk").textContent = produk ? "Edit produk" : "Tambah produk";
  document.getElementById("produk-kode").value = produk ? produk.kode : "";
  document.getElementById("produk-nama").value = produk ? produk.nama : "";
  document.getElementById("produk-barcode").value = produk ? produk.barcode || "" : "";
  document.getElementById("produk-kategori").value = produk ? produk.kategori : "";
  document.getElementById("produk-harga").value = produk ? produk.harga : "";
  document.getElementById("produk-stok").value = produk ? produk.stock ?? 0 : 0;
  dialog.showModal();
  document.getElementById("produk-nama").focus();
}

async function hapusProduk(kode) {
  const produk = KasirLogic.cariProduk(kode);
  if (!produk) return;
  if (!confirm(`Hapus produk "${produk.nama}" dari katalog?`)) return;
  try {
    await requestApi(`/api/products/${encodeURIComponent(kode)}`, { method: "DELETE" });
    await muatProduk();
    tampilkanPesan(`${produk.nama} dihapus dari katalog.`, "success");
  } catch (error) {
    tampilkanPesan(error.message, "error");
  }
}

let mediaStream = null;
let barcodeDetector = null;
let pemindaianAktif = false;

async function nyalakanKamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    tampilkanPesan("Kamera browser tidak tersedia. Gunakan ketik barcode.", "error");
    return;
  }
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    });
    const video = document.getElementById("kamera");
    video.srcObject = mediaStream;
    await video.play();
    document.getElementById("kamera-belum-aktif").classList.add("hidden");
    document.getElementById("tombol-kamera").textContent = "Matikan kamera";
    if ("BarcodeDetector" in window) {
      barcodeDetector = new BarcodeDetector({ formats: ["ean_13", "ean_8", "code_128", "qr_code", "upc_a", "upc_e"] });
      pemindaianAktif = true;
      pindaiFrame();
    } else {
      tampilkanPesan("Pemindaian otomatis tidak didukung browser ini. Gunakan ketik barcode.", "success");
    }
  } catch (error) {
    tampilkanPesan("Kamera tidak dapat dibuka. Periksa izin kamera atau gunakan ketik barcode.", "error");
  }
}

function matikanKamera() {
  pemindaianAktif = false;
  if (mediaStream) mediaStream.getTracks().forEach((track) => track.stop());
  mediaStream = null;
  document.getElementById("kamera").srcObject = null;
  document.getElementById("kamera-belum-aktif").classList.remove("hidden");
  document.getElementById("tombol-kamera").textContent = "Nyalakan kamera";
}

async function pindaiFrame() {
  if (!pemindaianAktif || !barcodeDetector) return;
  const video = document.getElementById("kamera");
  try {
    if (video.readyState >= 2) {
      const hasil = await barcodeDetector.detect(video);
      if (hasil.length) prosesBarcode(hasil[0].rawValue);
    }
  } catch {}
  requestAnimationFrame(pindaiFrame);
}

function prosesBarcode(barcode) {
  const kode = String(barcode || "").trim();
  if (!kode) return;
  document.getElementById("barcode-terbaca").textContent = `Terbaca: ${kode}`;
  const produk = KasirLogic.cariProdukByBarcode(kode);
  if (!produk) {
    pemindaianAktif = false;
    tampilkanPesan(`Barcode ${kode} belum ada. Lengkapi sebagai produk baru.`, "error");
    bukaDialogProduk();
    document.getElementById("produk-barcode").value = kode;
    setTimeout(() => pemindaianAktif && pindaiFrame(), 1500);
    return;
  }
  if ((produk.stock ?? 0) <= 0) {
    tampilkanPesan(`Stok ${produk.nama} habis.`, "error");
    return;
  }
  const itemAda = keranjang.find((item) => item.kode === produk.kode);
  if (itemAda && itemAda.qty >= (produk.stock ?? 0)) {
    tampilkanPesan(`Jumlah ${produk.nama} sudah mencapai stok tersedia.`, "error");
    return;
  }
  KasirLogic.tambahItem(keranjang, produk.kode);
  tampilkanPesan(`${produk.nama} ditambahkan ke keranjang.`, "success");
  render();
}

function ajukanPembayaran() {
  try {
    transaksiMenunggu = KasirLogic.buatTransaksi(
      keranjang,
      Number(elBayar.value),
      elMember.checked
    );
    isiRincian(document.getElementById("ringkasan-konfirmasi"), transaksiMenunggu);
    document.getElementById("langkah-konfirmasi").hidden = false;
    document.getElementById("langkah-struk").hidden = true;
    elDialog.showModal();
  } catch (error) {
    tampilkanPesan(error.message, "error");
  }
}

async function konfirmasiPembayaran() {
  if (!transaksiMenunggu) {
    tampilkanPesan("Tidak ada transaksi untuk dikonfirmasi.", "error");
    return;
  }
  try {
    const hasil = await requestApi("/api/transactions", {
      method: "POST",
      body: JSON.stringify({
        items: transaksiMenunggu.items,
        dibayar: transaksiMenunggu.dibayar,
        member: transaksiMenunggu.member,
      }),
    });
    const transaksiBaru = hasil.transaksi;
    isiRincian(document.getElementById("rincian-struk"), transaksiBaru);
    transaksiMenunggu = null;
    keranjang = [];
    elBayar.value = "";
    elMember.checked = false;
    document.getElementById("langkah-konfirmasi").hidden = true;
    document.getElementById("langkah-struk").hidden = false;
    await Promise.all([muatProduk(), muatTransaksi()]);
    tampilkanPesan("Pembayaran berhasil dan transaksi tersimpan.", "success");
    render();
  } catch (error) {
    tampilkanPesan(`Transaksi tidak dapat disimpan: ${error.message}`, "error");
  }
}

elProduk.addEventListener("click", (event) => {
  const tombolEdit = event.target.closest("[data-edit-produk]");
  if (tombolEdit) {
    bukaDialogProduk(tombolEdit.dataset.editProduk);
    return;
  }
  const tombolHapus = event.target.closest("[data-hapus-produk]");
  if (tombolHapus) {
    hapusProduk(tombolHapus.dataset.hapusProduk);
    return;
  }
  const tombol = event.target.closest("[data-kode]");
  if (!tombol) return;
  try {
    const produk = KasirLogic.cariProduk(tombol.dataset.kode);
    if ((produk.stock ?? 0) <= 0) throw new Error(`Stok ${produk.nama} habis`);
    const itemAda = keranjang.find((item) => item.kode === produk.kode);
    if (itemAda && itemAda.qty >= (produk.stock ?? 0)) {
      throw new Error(`Jumlah ${produk.nama} sudah mencapai stok tersedia`);
    }
    KasirLogic.tambahItem(keranjang, tombol.dataset.kode);
    tampilkanPesan(`${KasirLogic.cariProduk(tombol.dataset.kode).nama} ditambahkan ke keranjang.`, "success");
    render();
  } catch (error) {
    tampilkanPesan(error.message, "error");
  }
});

elKeranjang.addEventListener("click", (event) => {
  const tombol = event.target.closest("[data-action]");
  if (!tombol) return;
  try {
    const item = keranjang.find((produk) => produk.kode === tombol.dataset.kode);
    if (tombol.dataset.action === "remove") {
      keranjang = KasirLogic.hapusItem(keranjang, tombol.dataset.kode);
    } else {
      const jumlah = item.qty + (tombol.dataset.action === "increase" ? 1 : -1);
      if (tombol.dataset.action === "increase") {
        const produk = KasirLogic.cariProduk(item.kode);
        if (jumlah > (produk.stock ?? 0)) {
          throw new Error(`Stok ${produk.nama} tersisa ${produk.stock ?? 0}`);
        }
      }
      KasirLogic.ubahJumlah(keranjang, tombol.dataset.kode, jumlah);
    }
    render();
  } catch (error) {
    tampilkanPesan(error.message, "error");
  }
});

elPencarian.addEventListener("input", renderProduk);
elKategori.addEventListener("change", renderProduk);
elMember.addEventListener("change", () => {
  renderKeranjang();
  renderPembayaran();
});
elBayar.addEventListener("input", renderPembayaran);
document.getElementById("nominal-cepat").addEventListener("click", (event) => {
  const tombol = event.target.closest("[data-nominal]");
  if (!tombol) return;
  elBayar.value = tombol.dataset.nominal;
  renderPembayaran();
});
document.getElementById("form-pembayaran").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!event.currentTarget.reportValidity()) return;
  ajukanPembayaran();
});
document.getElementById("konfirmasi-pembayaran").addEventListener("click", konfirmasiPembayaran);
document.getElementById("batal-konfirmasi").addEventListener("click", () => {
  transaksiMenunggu = null;
  elDialog.close();
});
document.getElementById("tutup-struk").addEventListener("click", () => elDialog.close());
document.getElementById("kosongkan-keranjang").addEventListener("click", () => {
  keranjang = [];
  elBayar.value = "";
  tampilkanPesan("Keranjang dikosongkan.", "success");
  render();
});
elDialog.addEventListener("close", () => {
  transaksiMenunggu = null;
});

document.getElementById("tombol-tambah-produk").addEventListener("click", () => bukaDialogProduk());
document.getElementById("batal-produk").addEventListener("click", () => {
  document.getElementById("dialog-produk").close();
});
document.getElementById("produk-gambar").addEventListener("change", async (event) => {
  const file = event.currentTarget.files?.[0];
  if (!file) return;
  const status = document.getElementById("produk-gambar-status");
  const tombolSimpan = document.querySelector("#form-produk button[type='submit']");
  gambarProdukDiproses = true;
  tombolSimpan.disabled = true;
  status.textContent = "Memperkecil foto...";
  try {
    gambarProdukPerubahan = await kompresFotoProduk(file);
    tampilkanPratinjauGambar(gambarProdukPerubahan);
    status.textContent = `Foto siap disimpan (${Math.ceil(file.size / 1024)} KB asli).`;
  } catch (error) {
    document.getElementById("produk-gambar").value = "";
    status.textContent = error.message;
  } finally {
    gambarProdukDiproses = false;
    tombolSimpan.disabled = false;
  }
});
document.getElementById("hapus-produk-gambar").addEventListener("click", () => {
  gambarProdukPerubahan = "";
  document.getElementById("produk-gambar").value = "";
  tampilkanPratinjauGambar("");
  document.getElementById("produk-gambar-status").textContent = "Foto akan dihapus saat produk disimpan.";
});
document.getElementById("form-produk").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!event.currentTarget.reportValidity()) return;
  if (gambarProdukDiproses) {
    document.getElementById("produk-gambar-status").textContent = "Tunggu sampai foto selesai diproses.";
    return;
  }
  const kode = document.getElementById("produk-kode").value;
  const barcode = document.getElementById("produk-barcode").value.trim();
  const nama = document.getElementById("produk-nama").value.trim();
  const kategori = document.getElementById("produk-kategori").value.trim();
  const harga = Number(document.getElementById("produk-harga").value);
  const stock = Number(document.getElementById("produk-stok").value);
  const duplikat = KasirLogic.daftarProduk().find((produk) =>
    produk.barcode === barcode && produk.kode !== kode
  );
  if (duplikat) {
    tampilkanPesan(`Barcode sudah dipakai oleh ${duplikat.nama}.`, "error");
    return;
  }
  try {
    const options = {
      method: kode ? "PUT" : "POST",
      body: JSON.stringify({
        nama,
        barcode,
        kategori,
        harga,
        stock,
        ...(gambarProdukPerubahan === null ? {} : { gambar: gambarProdukPerubahan }),
      }),
    };
    await requestApi(kode ? `/api/products/${encodeURIComponent(kode)}` : "/api/products", options);
    await muatProduk();
    document.getElementById("dialog-produk").close();
    tampilkanPesan(`${nama} berhasil disimpan ke katalog.`, "success");
  } catch (error) {
    tampilkanPesan(error.message, "error");
  }
});

document.getElementById("tombol-kamera").addEventListener("click", () => {
  if (mediaStream) matikanKamera();
  else nyalakanKamera();
});
document.getElementById("form-barcode").addEventListener("submit", (event) => {
  event.preventDefault();
  prosesBarcode(document.getElementById("input-barcode").value);
  document.getElementById("input-barcode").value = "";
});

Promise.all([muatProduk(), muatTransaksi()]);
