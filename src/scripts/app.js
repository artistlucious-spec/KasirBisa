// Pengendali halaman kasir: menghubungkan elemen HTML, KasirLogic, dan API server.
let keranjang = [];
let transaksiTersimpan = [];
let transaksiMenunggu = null;
let pesanKesalahanPenyimpanan = "";
let gambarProdukPerubahan = null;
let gambarProdukDiproses = false;
let pengaturanPembayaran = { paymentQrs: [], limit: 10 };
let cartRestoreAttempted = false;

const elProduk = document.getElementById("daftar-produk");
const elPencarian = document.getElementById("cari-produk");
const elKategori = document.getElementById("filter-kategori");
const elKeranjang = document.getElementById("daftar-keranjang");
const elBayar = document.getElementById("bayar");
const elMember = document.getElementById("member");
const elDialog = document.getElementById("dialog-transaksi");
const PLACEHOLDER_GAMBAR_PRODUK = "assets/images/placeholder-produk.png";

function rupiah(angka) {
  return "Rp" + Number(angka).toLocaleString("id-ID");
}

function namaQrTampilan(nama) {
  return nama === "QRIS" ? "QR" : nama;
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

function aturGambarProduk(img, gambar, namaProduk) {
  const punyaFoto = Boolean(gambar);
  img.dataset.placeholder = String(!punyaFoto);
  img.classList.remove("image-unavailable");
  img.alt = punyaFoto ? namaProduk : `Belum ada foto untuk ${namaProduk}`;
  img.src = gambar || PLACEHOLDER_GAMBAR_PRODUK;
  img.onerror = () => {
    if (img.dataset.placeholder === "true") {
      img.removeAttribute("src");
      img.alt = "Gambar produk tidak tersedia";
      img.classList.add("image-unavailable");
      return;
    }

    img.dataset.placeholder = "true";
    img.alt = `Belum ada foto untuk ${namaProduk}`;
    img.src = PLACEHOLDER_GAMBAR_PRODUK;
  };
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
  if (gambar) aturGambarProduk(img, gambar, "Foto produk");
  else {
    img.removeAttribute("src");
    img.onerror = null;
  }
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
    const areaGambar = elemen("div", "product-image-wrap");
    const gambar = document.createElement("img");
    gambar.loading = "lazy";
    aturGambarProduk(gambar, produk.gambar, produk.nama);
    const jumlahDiKeranjang = keranjang.find((item) => item.kode === produk.kode)?.qty || 0;
    const badgeJumlah = elemen("span", "product-cart-count", String(jumlahDiKeranjang));
    badgeJumlah.hidden = jumlahDiKeranjang === 0;
    badgeJumlah.setAttribute("aria-label", `${jumlahDiKeranjang} ${produk.nama} di keranjang`);
    areaGambar.append(gambar, badgeJumlah);

    const info = elemen("div", "product-info");
    info.append(
      elemen("span", "product-category", produk.kategori),
      elemen("h3", "", produk.nama),
      elemen("strong", "product-price", rupiah(produk.harga)),
      elemen("span", "stock-badge", `Stok ${produk.stock ?? 0} · ${produk.barcode || "-"}`)
    );
    const aksi = elemen("div", "product-card-actions");
    const stokTersedia = Number(produk.stock ?? 0);
    const stokHabis = !Number.isFinite(stokTersedia) || jumlahDiKeranjang >= stokTersedia;
    const tambah = elemen("button", "add-button", stokHabis ? "Habis" : "Tambah");
    tambah.type = "button";
    tambah.disabled = stokHabis;
    tambah.dataset.kode = produk.kode;
    tambah.setAttribute("aria-label", stokHabis ? `Stok ${produk.nama} habis` : `Tambah ${produk.nama} ke keranjang`);
    aksi.appendChild(tambah);
    if (jumlahDiKeranjang > 0) {
      const kurang = elemen("button", "decrease-button", "Kurangi");
      kurang.type = "button";
      kurang.dataset.kode = produk.kode;
      kurang.dataset.action = "decrease";
      kurang.setAttribute("aria-label", `Kurangi satu ${produk.nama} dari keranjang`);
      aksi.appendChild(kurang);
    }
    kartu.append(areaGambar, info, aksi);
    elProduk.appendChild(kartu);
  }
}

function renderKeranjang() {
  elKeranjang.replaceChildren();
  const kosong = keranjang.length === 0;
  document.getElementById("keranjang-kosong").hidden = !kosong;
  document.getElementById("kosongkan-keranjang").disabled = kosong;
  const jumlahItem = keranjang.reduce((jumlah, item) => jumlah + item.qty, 0);
  document.getElementById("jumlah-keranjang").textContent = String(jumlahItem);
  const jumlahMobile = document.getElementById("jumlah-keranjang-mobile");
  const totalMobile = document.getElementById("total-keranjang-mobile");
  if (jumlahMobile) jumlahMobile.textContent = String(jumlahItem);
  if (totalMobile) {
    const ringkasanMobile = KasirLogic.hitungRingkasan(keranjang, elMember.checked);
    totalMobile.textContent = rupiah(ringkasanMobile.total);
  }

  for (const item of keranjang) {
    const baris = elemen("article", "cart-item");
    const gambar = document.createElement("img");
    gambar.className = "cart-item-image";
    gambar.setAttribute("aria-hidden", "true");
    gambar.loading = "lazy";
    aturGambarProduk(gambar, item.gambar, item.nama);

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
  const pilihanQris = document.getElementById("metode-qris");
  const pilihanQr = document.getElementById("pilihan-qris");
  const qrActives = (pengaturanPembayaran.paymentQrs || []).filter((qr) => qr.enabled);
  const qrSelected = qrActives.find((qr) => qr.id === pilihanQr.value) || qrActives[0] || null;
  const qrisReady = Boolean(qrSelected?.image);
  const isQris = pilihanQris.checked;
  pilihanQr.replaceChildren(...qrActives.map((qr) => new Option(namaQrTampilan(qr.name), qr.id)));
  if (qrSelected) pilihanQr.value = qrSelected.id;
  document.getElementById("qris-selection-wrap").hidden = !isQris || !qrActives.length;
  pilihanQr.disabled = !qrActives.length;
  pilihanQris.disabled = false;
  document.getElementById("status-pilihan-qris").textContent =
    qrisReady ? "Periksa pembayaran secara manual" : "Tambahkan QR toko terlebih dahulu";
  document.getElementById("qris-management-links").hidden = !isQris;
  const dibayar = isQris ? total : elBayar.value.trim() === "" ? NaN : Number(elBayar.value);
  const valid = isQris
    ? qrisReady
    : Number.isSafeInteger(dibayar) && dibayar >= total;
  elBayar.required = !isQris;
  elBayar.disabled = isQris;
  document.getElementById("baris-uang-diterima").hidden = isQris;
  document.getElementById("baris-kembalian").hidden = isQris;
  document.getElementById("panduan-qris-kasir").hidden = !isQris || !qrisReady;
  const qrisImage = document.getElementById("gambar-qris-kasir");
  if (qrSelected) {
    qrisImage.src = qrSelected.image;
    qrisImage.alt = `QR ${qrSelected.name} untuk dipindai pelanggan`;
  } else {
    qrisImage.removeAttribute("src");
  }
  document.getElementById("kembalian").textContent =
    valid && !isQris ? rupiah(dibayar - total) : rupiah(0);
  document.getElementById("tombol-bayar").disabled =
    Boolean(pesanKesalahanPenyimpanan) || keranjang.length === 0 || !valid;
  document.getElementById("tombol-bayar").textContent = isQris ? "Lanjut ke konfirmasi" : "Bayar";
  renderNominalCepat(total);
}


function render() {
  renderProduk();
  renderKeranjang();
  renderPembayaran();
}

let transaksiUntukStruk = null;
let infoTokoUntukStruk = null;
function isiRincian(target, transaksi) {
  transaksiUntukStruk = transaksi;
  target.replaceChildren();
  const store = infoTokoUntukStruk || window.kasirSessionData || {};
  const card = elemen("article", "receipt-paper");
  const header = elemen("div", "receipt-brand");
  header.append(elemen("strong", "", store.businessName || "TOKO ANDA"), elemen("small", "", "Terima kasih telah berbelanja"));
  const meta = elemen("div", "receipt-meta");
  const shortId = String(transaksi.id || "").replace(/^TRX-/, "").slice(-8).toUpperCase();
  meta.append(elemen("span", "", `No. ${shortId || "-"}`), elemen("span", "", new Date(transaksi.waktu).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })));
  const divider = () => elemen("div", "receipt-divider");
  const items = elemen("div", "receipt-items");
  for (const item of transaksi.items || []) {
    const line = elemen("div", "receipt-item");
    const left = elemen("div", "receipt-item-name");
    left.append(elemen("strong", "", item.nama), elemen("small", "", `${item.qty} × ${rupiah(item.harga)}`));
    line.append(left, elemen("strong", "", rupiah(Number(item.harga) * Number(item.qty)))); items.append(line);
  }
  const totals = elemen("div", "receipt-totals");
  const formatReceiptAmount = (value) => Number(value) < 0 ? `-${rupiah(Math.abs(Number(value)))}` : rupiah(value);
  const addTotal = (label, value, strong = false) => { const line = elemen("div", strong ? "receipt-total grand" : "receipt-total"); line.append(elemen("span", "", label), elemen("strong", "", formatReceiptAmount(value))); totals.append(line); };
  addTotal("Subtotal", transaksi.subtotal);
  if (Number(transaksi.diskon || 0)) addTotal("Diskon", -Number(transaksi.diskon));
  if (Number(transaksi.ppn || 0)) addTotal("PPN", transaksi.ppn);
  addTotal("Total", transaksi.total, true);
  const payment = elemen("div", "receipt-totals receipt-payment");
  const payLine = (label, value) => { const line = elemen("div", "receipt-total"); line.append(elemen("span", "", label), elemen("strong", "", rupiah(value))); payment.append(line); };
  payLine(transaksi.metodePembayaran === "qris" ? namaQrTampilan(transaksi.labelPembayaran || "QR") : "Tunai", transaksi.dibayar);
  if (transaksi.metodePembayaran !== "qris") payLine("Kembalian", transaksi.kembalian);
  const footer = elemen("div", "receipt-footer"); footer.append(elemen("strong", "", "Terima kasih atas kunjungan Anda!"), elemen("small", "", "Semoga hari Anda menyenangkan."));
  card.append(header, divider(), meta, divider(), elemen("h3", "receipt-items-title", "Rincian belanja"), items, divider(), totals, payment, divider(), footer);
  target.append(card);
}

async function loadStoreInfoForReceipt() {
  if (infoTokoUntukStruk) return infoTokoUntukStruk;
  if (window.kasirSessionData) { infoTokoUntukStruk = window.kasirSessionData; return infoTokoUntukStruk; }
  try { const response = await fetch("/api/auth/session", { cache: "no-store" }); if (response.ok) infoTokoUntukStruk = await response.json(); } catch {}
  return infoTokoUntukStruk || {};
}

function buatCanvasStruk(transaksi) {
  const width = 720, padding = 54, contentWidth = width - padding * 2;
  const canvas = document.createElement("canvas"); canvas.width = width;
  const measure = document.createElement("canvas").getContext("2d");
  const store = infoTokoUntukStruk?.businessName || "TOKO ANDA";
  const date = new Date(transaksi.waktu).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
  const ops = []; let y = padding;
  const addText = (value, x, yy, font, color = "#182433", align = "left") => ops.push({ type: "text", value: String(value), x, y: yy, font, color, align });
  const addRule = () => { ops.push({ type: "rule", y }); y += 30; };
  const wrap = (value, maxWidth, font) => { measure.font = font; let line = "", out = []; for (const word of String(value).split(/\s+/)) { const next = line ? `${line} ${word}` : word; if (measure.measureText(next).width > maxWidth && line) { out.push(line); line = word; } else line = next; } if (line) out.push(line); return out; };
  addText(store, width/2, y, "bold 34px Arial", "#14243a", "center"); y += 36;
  addText("Terima kasih telah berbelanja", width/2, y, "20px Arial", "#667085", "center"); y += 30; addRule();
  addText(`No. ${String(transaksi.id || "").replace(/^TRX-/, "").slice(-8).toUpperCase()}`, padding, y, "18px Arial");
  addText(date, width-padding, y, "18px Arial", "#667085", "right"); y += 34; addRule();
  addText("RINCIAN BELANJA", padding, y, "bold 19px Arial", "#667085"); y += 34;
  for (const item of transaksi.items || []) {
    const lines = wrap(item.nama, contentWidth - 220, "bold 21px Arial");
    lines.forEach((line, index) => addText(line, padding, y + index*27, "bold 21px Arial"));
    addText(rupiah(Number(item.harga) * Number(item.qty)), width-padding, y, "bold 21px Arial", "#182433", "right");
    y += Math.max(30, lines.length*27); addText(`${item.qty} × ${rupiah(item.harga)}`, padding, y, "17px Arial", "#667085"); y += 34;
  }
  addRule();
  const formatReceiptAmount = (value) => Number(value) < 0 ? `-${rupiah(Math.abs(Number(value)))}` : rupiah(value);
  const total = (label, value, bold = false) => { addText(label, padding, y, `${bold ? "bold " : ""}20px Arial`, bold ? "#14243a" : "#667085"); addText(formatReceiptAmount(value), width-padding, y, `${bold ? "bold " : ""}${bold ? 27 : 20}px Arial`, bold ? "#1769c2" : "#182433", "right"); y += bold ? 42 : 32; };
  total("Subtotal", transaksi.subtotal); if (Number(transaksi.diskon || 0)) total("Diskon", -Number(transaksi.diskon));
  if (Number(transaksi.ppn || 0)) total("PPN", transaksi.ppn); total("TOTAL", transaksi.total, true);
  y += 8; total(transaksi.metodePembayaran === "qris" ? namaQrTampilan(transaksi.labelPembayaran || "QR") : "Tunai", transaksi.dibayar);
  if (transaksi.metodePembayaran !== "qris") total("Kembalian", transaksi.kembalian);
  y += 14; addRule();
  addText("Terima kasih atas kunjungan Anda!", width/2, y, "bold 21px Arial", "#14243a", "center"); y += 30;
  addText("Semoga hari Anda menyenangkan.", width/2, y, "18px Arial", "#667085", "center");
  canvas.height = y + padding;
  const ctx = canvas.getContext("2d"); ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, width, canvas.height);
  for (const op of ops) {
    if (op.type === "rule") { ctx.strokeStyle = "#d7dee8"; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo(padding, op.y); ctx.lineTo(width-padding, op.y); ctx.stroke(); ctx.setLineDash([]); }
    else { ctx.font = op.font; ctx.fillStyle = op.color; ctx.textAlign = op.align; ctx.fillText(op.value, op.x, op.y); }
  }
  return canvas;
}

async function getStrukBlob() {
  if (!transaksiUntukStruk) throw new Error("Belum ada struk transaksi.");
  await loadStoreInfoForReceipt();
  const canvas = buatCanvasStruk(transaksiUntukStruk);
  return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("Gambar struk tidak dapat dibuat.")),"image/png"));
}
async function simpanStruk() {
  try { const blob=await getStrukBlob(); const url=URL.createObjectURL(blob); const link=document.createElement("a"); link.href=url; link.download=`struk-${String(transaksiUntukStruk.id||"transaksi").slice(-8)}.png`; link.click(); setTimeout(()=>URL.revokeObjectURL(url),1500); tampilkanPesan("Struk berhasil disiapkan sebagai gambar PNG.","success"); }
  catch(error){tampilkanPesan(error.message,"error");}
}
async function bagikanStruk() {
  try { const blob=await getStrukBlob(); const file=new File([blob],`struk-${String(transaksiUntukStruk.id||"transaksi").slice(-8)}.png`,{type:"image/png"});
    if(navigator.canShare?.({files:[file]})&&navigator.share){await navigator.share({files:[file],title:"Struk KASIR BISA",text:"Terima kasih telah berbelanja."});}
    else {const textShare=`Struk transaksi ${String(transaksiUntukStruk.id||"").slice(-8)}\nTotal: ${rupiah(transaksiUntukStruk.total)}\nTerima kasih telah berbelanja.`;window.location.href = `https://wa.me/?text=${encodeURIComponent(textShare)}`;tampilkanPesan("Browser belum mendukung berbagi gambar langsung. WhatsApp dibuka dengan ringkasan teks; gambar dapat disimpan lalu dilampirkan.","success");}
  } catch(error){if(error.name!=="AbortError")tampilkanPesan(error.message,"error");}
}

async function putarSuaraTransaksiSukses() {
  const audio = document.getElementById("suara-transaksi-sukses");
  if (!audio) return false;

  try {
    audio.currentTime = 0;
    await audio.play();
    return true;
  } catch {
    return false;
  }
}

async function requestApi(url, options = {}) {
  // Semua akses database melewati API; sesi yang habis kembali ke halaman login.
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({ error: "Respons server tidak valid" }));
  if (response.status === 401) window.location.replace("/login.html");
  if (!response.ok) throw new Error(data.error || "Permintaan ke database gagal");
  return data;
}

async function muatPengaturanPembayaran() {
  try {
    pengaturanPembayaran = await requestApi("/api/payment-settings");
    renderPembayaran();
  } catch (error) {
    tampilkanPesan(`Pengaturan QR tidak dapat dimuat: ${error.message}`, "error");
    renderPembayaran();
  }
}

async function muatProduk() {
  try {
    const produk = await requestApi("/api/products");
    if (Array.isArray(produk)) {
      KasirLogic.gantiProduk(produk);
      if (!cartRestoreAttempted) {
        cartRestoreAttempted = true;
        let savedCart = null;
        try {
          savedCart = sessionStorage.getItem("kasir-cart-before-qris");
          sessionStorage.removeItem("kasir-cart-before-qris");
        } catch {
          tampilkanPesan("Keranjang sebelumnya tidak dapat dipulihkan dari penyimpanan sesi.", "error");
        }
        if (savedCart) {
          try {
            const parsedCart = JSON.parse(savedCart);
            if (Array.isArray(parsedCart)) {
              keranjang = parsedCart.flatMap((item) => {
                const current = KasirLogic.cariProduk(item?.kode);
                const qty = Number(item?.qty);
                return current && Number.isSafeInteger(qty) && qty > 0 && qty <= Math.min(99, Number(current.stock) || 0)
                  ? [{ ...current, qty }]
                  : [];
              });
            }
          } catch {
            tampilkanPesan("Keranjang sebelumnya tidak dapat dipulihkan.", "error");
          }
        }
      }
      isiKategori();
      render();
    }
  } catch (error) {
    pesanKesalahanPenyimpanan = error.message;
    tampilkanPesan(`Database produk tidak dapat dimuat: ${error.message}`, "error");
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
let barcodeTerakhir = "";
let waktuBarcodeTerakhir = 0;

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
    document.querySelector(".camera-frame").classList.add("camera-active");
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
  barcodeTerakhir = "";
  waktuBarcodeTerakhir = 0;
  if (mediaStream) mediaStream.getTracks().forEach((track) => track.stop());
  mediaStream = null;
  document.getElementById("kamera").srcObject = null;
  document.querySelector(".camera-frame").classList.remove("camera-active");
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
  const sekarang = Date.now();
  if (kode === barcodeTerakhir && sekarang - waktuBarcodeTerakhir < 1400) return;
  barcodeTerakhir = kode;
  waktuBarcodeTerakhir = sekarang;
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
  tampilkanPesan("");
  render();
}

function ajukanPembayaran() {
  try {
    const metodePembayaran = document.querySelector('input[name="metode-pembayaran"]:checked').value;
    const total = KasirLogic.hitungRingkasan(keranjang, elMember.checked).total;
    const qrSelected = (pengaturanPembayaran.paymentQrs || []).find((qr) =>
      qr.id === document.getElementById("pilihan-qris").value && qr.enabled && qr.image
    );
    if (metodePembayaran === "qris" && !qrSelected) {
      throw new Error("Pilih QR toko yang aktif terlebih dahulu.");
    }
    transaksiMenunggu = KasirLogic.buatTransaksi(
      keranjang,
      metodePembayaran === "qris" ? total : Number(elBayar.value),
      elMember.checked
    );
    transaksiMenunggu.metodePembayaran = metodePembayaran;
    transaksiMenunggu.paymentQrId = metodePembayaran === "qris" ? qrSelected.id : "";
    transaksiMenunggu.labelPembayaran = metodePembayaran === "qris" ? qrSelected.name : "Tunai";
    isiRincian(document.getElementById("ringkasan-konfirmasi"), transaksiMenunggu);
    const konfirmasiQris = document.getElementById("konfirmasi-qris");
    konfirmasiQris.hidden = metodePembayaran !== "qris";
    document.getElementById("konfirmasi-pembayaran").textContent =
      metodePembayaran === "qris" ? "Pembayaran diterima & simpan" : "Konfirmasi & bayar";
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
    // Server memeriksa ulang harga/stok dan menyimpan transaksi sebelum keranjang dikosongkan.
    const hasil = await requestApi("/api/transactions", {
      method: "POST",
      body: JSON.stringify({
        items: transaksiMenunggu.items,
        dibayar: transaksiMenunggu.dibayar,
        member: transaksiMenunggu.member,
        paymentMethod: transaksiMenunggu.metodePembayaran,
        paymentQrId: transaksiMenunggu.paymentQrId,
        qrisConfirmed: transaksiMenunggu.metodePembayaran === "qris",
      }),
    });
    const transaksiBaru = hasil.transaksi;
    await loadStoreInfoForReceipt();
    isiRincian(document.getElementById("rincian-struk"), transaksiBaru);
    transaksiMenunggu = null;
    keranjang = [];
    elBayar.value = "";
    elMember.checked = false;
    document.getElementById("metode-tunai").checked = true;
    document.getElementById("langkah-konfirmasi").hidden = true;
    document.getElementById("langkah-struk").hidden = false;
    await muatProduk();
    const suaraDiputar = await putarSuaraTransaksiSukses();
    tampilkanPesan(
      suaraDiputar
        ? "Pembayaran berhasil dan transaksi tersimpan."
        : "Pembayaran berhasil, tetapi suara notifikasi tidak dapat diputar.",
      "success"
    );
    render();
  } catch (error) {
    tampilkanPesan(`Transaksi tidak dapat disimpan: ${error.message}`, "error");
  }
}

elProduk.addEventListener("click", (event) => {
  const tombol = event.target.closest("[data-kode]");
  if (!tombol) return;
  try {
    if (tombol.dataset.action === "decrease") {
      const item = keranjang.find((produk) => produk.kode === tombol.dataset.kode);
      if (!item) throw new Error("Produk tidak ditemukan di keranjang");
      if (item.qty === 1) {
        keranjang = KasirLogic.hapusItem(keranjang, tombol.dataset.kode);
      } else {
        KasirLogic.ubahJumlah(keranjang, tombol.dataset.kode, item.qty - 1);
      }
      render();
      return;
    }

    const produk = KasirLogic.cariProduk(tombol.dataset.kode);
    if ((produk.stock ?? 0) <= 0) throw new Error(`Stok ${produk.nama} habis`);
    const itemAda = keranjang.find((item) => item.kode === produk.kode);
    if (itemAda && itemAda.qty >= (produk.stock ?? 0)) {
      throw new Error(`Jumlah ${produk.nama} sudah mencapai stok tersedia`);
    }
    KasirLogic.tambahItem(keranjang, tombol.dataset.kode);
    tampilkanPesan("");
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
document.querySelectorAll('input[name="metode-pembayaran"]').forEach((input) => {
  input.addEventListener("change", renderPembayaran);
});
document.getElementById("pilihan-qris").addEventListener("change", renderPembayaran);
document.querySelectorAll("[data-preserve-cart]").forEach((link) => {
  link.addEventListener("click", () => {
    try {
      sessionStorage.setItem(
        "kasir-cart-before-qris",
        JSON.stringify(keranjang.map(({ kode, qty }) => ({ kode, qty })))
      );
    } catch {
      tampilkanPesan("Keranjang tidak dapat disimpan sementara sebelum membuka pengaturan QR.", "error");
    }
  });
});
window.addEventListener("pageshow", (event) => {
  if (!event.persisted) return;
  try {
    sessionStorage.removeItem("kasir-cart-before-qris");
  } catch {
    tampilkanPesan("Keranjang sementara tidak dapat dibersihkan dari penyimpanan sesi.", "error");
  }
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
document.getElementById("simpan-struk").addEventListener("click", simpanStruk);
document.getElementById("bagikan-struk").addEventListener("click", bagikanStruk);
document.getElementById("cetak-struk").addEventListener("click", () => {
  const receipt = document.querySelector("#rincian-struk .receipt-paper");
  if (!transaksiUntukStruk || !receipt) {
    tampilkanPesan("Rincian struk belum siap dicetak.", "error");
    return;
  }
  const printArea = document.getElementById("struk-cetak");
  printArea.replaceChildren(receipt.cloneNode(true));
  window.addEventListener("afterprint", () => printArea.replaceChildren(), { once: true });
  window.print();
});
document.getElementById("kosongkan-keranjang").addEventListener("click", () => {
  keranjang = [];
  elBayar.value = "";
  tampilkanPesan("Keranjang dikosongkan.", "success");
  render();
});
elDialog.addEventListener("close", () => {
  transaksiMenunggu = null;
});

const tombolKeranjangMobile = document.getElementById("tombol-keranjang-mobile");
const panelKeranjang = document.getElementById("panel-keranjang");
const tombolTutupKeranjang = document.getElementById("tutup-keranjang-mobile");
const latarKeranjangMobile = document.getElementById("latar-keranjang-mobile");

function aturPanelKeranjangMobile(buka) {
  if (!tombolKeranjangMobile || !panelKeranjang) return;
  panelKeranjang.classList.toggle("is-open", buka);
  tombolKeranjangMobile.setAttribute("aria-expanded", String(buka));
  document.body.classList.toggle("cart-open", buka);
}

tombolKeranjangMobile?.addEventListener("click", () => {
  aturPanelKeranjangMobile(!panelKeranjang.classList.contains("is-open"));
});
tombolTutupKeranjang?.addEventListener("click", () => aturPanelKeranjangMobile(false));
latarKeranjangMobile?.addEventListener("click", () => aturPanelKeranjangMobile(false));
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") aturPanelKeranjangMobile(false);
});
window.addEventListener("resize", () => {
  if (window.innerWidth > 700) aturPanelKeranjangMobile(false);
});

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
    gambarProdukPerubahan = await KasirImageUtils.kompresKeWebp(file);
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
    const produkSebelum = kode ? KasirLogic.cariProduk(kode) : null;
    const hargaLama = produkSebelum ? Number(produkSebelum.harga) : null;
    await requestApi(kode ? `/api/products/${encodeURIComponent(kode)}` : "/api/products", options);
    await muatProduk();
    const produkTerbaru = kode ? KasirLogic.cariProduk(kode) : null;
    const itemKeranjang = kode ? keranjang.find(item => item.kode === kode) : null;
    let pesanSimpan = `${nama} berhasil disimpan ke katalog.`;
    if (produkTerbaru && itemKeranjang) {
      itemKeranjang.nama = produkTerbaru.nama;
      itemKeranjang.kategori = produkTerbaru.kategori;
      itemKeranjang.harga = produkTerbaru.harga;
      itemKeranjang.gambar = produkTerbaru.gambar;
      const hargaBerubah = hargaLama !== Number(produkTerbaru.harga);
      const stokKurang = Number(produkTerbaru.stock || 0) < itemKeranjang.qty;
      if (hargaBerubah) pesanSimpan = `Harga ${produkTerbaru.nama} berubah dari ${rupiah(hargaLama)} menjadi ${rupiah(produkTerbaru.harga)}. Keranjang telah diperbarui.`;
      else pesanSimpan = `${produkTerbaru.nama} diperbarui. Informasi di keranjang ikut diperbarui.`;
      if (stokKurang) pesanSimpan += ` Perhatian: stok sekarang ${produkTerbaru.stock} unit, sedangkan keranjang berisi ${itemKeranjang.qty}. Sesuaikan jumlah sebelum pembayaran.`;
    }
    document.getElementById("dialog-produk").close();
    tampilkanPesan(pesanSimpan, "success");
    render();
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

muatPengaturanPembayaran();
muatProduk();
