// Pengelolaan produk terpisah dari halaman Kasir; memakai API yang sudah tersedia.
const $ = (id) => document.getElementById(id);
const formatRupiah = (n) => `Rp${Number(n || 0).toLocaleString("id-ID")}`;
let produkList = [];
let filterStok = "all";
let gambarPerubahan = null;
let gambarSedangDiproses = false;

async function api(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({ error: "Respons server tidak valid" }));
  if (response.status === 401) location.replace("login.html");
  if (!response.ok) throw new Error(data.error || "Permintaan tidak berhasil");
  return data;
}
function pesanProduk(text, type = "") { $("pesan-produk").textContent = text; $("pesan-produk").className = `notice ${type}`.trim(); }
function statusStok(stock) { return stock <= 0 ? ["Habis", "out"] : stock <= 10 ? ["Stok menipis", "low"] : ["Tersedia", "available"]; }
function gambarFallback(img, src, name) {
  img.alt = `Foto ${name}`;
  img.src = src || "assets/images/placeholder-produk.png";
  img.onerror = () => { img.onerror = null; img.src = "assets/images/placeholder-produk.png"; };
}
function updateRingkasan() {
  const total = produkList.reduce((sum, p) => sum + Number(p.stock || 0), 0);
  $("stat-jenis").textContent = produkList.length.toLocaleString("id-ID");
  $("stat-total").textContent = total.toLocaleString("id-ID");
  $("stat-menipis").textContent = produkList.filter(p => p.stock > 0 && p.stock <= 10).length.toLocaleString("id-ID");
  $("stat-habis").textContent = produkList.filter(p => Number(p.stock) <= 0).length.toLocaleString("id-ID");
}
function isiKategori() {
  const select = $("filter-kategori-manage"); const current = select.value;
  const categories = [...new Set(produkList.map(p => p.kategori).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"id-ID"));
  select.replaceChildren(new Option("Semua kategori", ""), ...categories.map(c => new Option(c,c)));
  select.value = categories.includes(current) ? current : "";
}
function renderProduk() {
  const target = $("daftar-produk-manage"); target.replaceChildren();
  const term = $("cari-produk-manage").value.trim().toLocaleLowerCase("id-ID");
  const category = $("filter-kategori-manage").value;
  const rows = produkList.filter(p => {
    const [_, state] = statusStok(Number(p.stock || 0));
    return (!term || `${p.nama} ${p.barcode || ""}`.toLocaleLowerCase("id-ID").includes(term)) && (!category || p.kategori === category) && (filterStok === "all" || state === filterStok);
  });
  $("jumlah-produk").textContent = `${rows.length} dari ${produkList.length} produk`;
  if (!rows.length) { const empty = document.createElement("p"); empty.className = "empty-state"; empty.textContent = "Produk tidak ditemukan. Coba ubah pencarian atau filter."; target.append(empty); return; }
  rows.forEach(p => {
    const card = document.createElement("article"); card.className = "management-product";
    const img = document.createElement("img"); img.className = "management-product-image"; img.loading = "lazy"; gambarFallback(img,p.gambar,p.nama);
    const body = document.createElement("div"); body.className = "management-product-info";
    const title = document.createElement("h3"); title.textContent = p.nama;
    const meta = document.createElement("p"); meta.textContent = `${p.kategori} · Barcode ${p.barcode || "—"}`;
    const price = document.createElement("strong"); price.textContent = formatRupiah(p.harga);
    const stockLine = document.createElement("div"); stockLine.className = "stock-line";
    const stock = document.createElement("span"); stock.textContent = `Stok ${Number(p.stock || 0)} unit`;
    const [label,state] = statusStok(Number(p.stock || 0)); const badge = document.createElement("span"); badge.className = `stock-status ${state}`; badge.textContent = label;
    stockLine.append(stock,badge); body.append(title,meta,price,stockLine);
    const actions = document.createElement("div"); actions.className = "management-product-actions";
    const edit = document.createElement("button"); edit.className = "secondary-button"; edit.type = "button"; edit.textContent = "Edit"; edit.addEventListener("click",()=>bukaForm(p));
    const del = document.createElement("button"); del.className = "icon-action danger-action"; del.type = "button"; del.textContent = "⋯"; del.setAttribute("aria-label",`Hapus ${p.nama}`); del.addEventListener("click",()=>hapusProduk(p));
    actions.append(edit,del); card.append(img,body,actions); target.append(card);
  });
}
async function muatProduk() {
  try { const data = await api("/api/products"); produkList = Array.isArray(data) ? data : []; updateRingkasan(); isiKategori(); renderProduk(); }
  catch (error) { pesanProduk(`Produk belum dapat dimuat: ${error.message}`, "error"); $("daftar-produk-manage").textContent = "Periksa koneksi lalu muat ulang halaman."; }
}
function pratinjau(gambar) {
  const wrap = $("manage-preview"); wrap.hidden = !gambar;
  if (gambar) { const img = $("manage-preview-img"); img.src = gambar; img.onerror = () => { img.removeAttribute("src"); }; }
}
function bukaForm(product = null) {
  gambarPerubahan = null; gambarSedangDiproses = false;
  $("form-produk-manage").reset(); $("manage-kode").value = product?.kode || "";
  $("judul-form-produk").textContent = product ? "Edit produk" : "Tambah produk";
  $("manage-nama").value = product?.nama || ""; $("manage-barcode").value = product?.barcode || "";
  $("manage-kategori").value = product?.kategori || ""; $("manage-harga").value = product?.harga ?? ""; $("manage-stok").value = product?.stock ?? 0;
  pratinjau(product?.gambar || ""); $("manage-image-status").textContent = "";
  $("dialog-produk-manage").showModal(); $("manage-nama").focus();
}
async function hapusProduk(product) {
  if (!confirm(`Hapus produk “${product.nama}” dari katalog? Produk tidak lagi muncul pada pilihan kasir.`)) return;
  try { await api(`/api/products/${encodeURIComponent(product.kode)}`, {method:"DELETE"}); await muatProduk(); pesanProduk(`${product.nama} berhasil dihapus.`, "success"); }
  catch (error) { pesanProduk(error.message,"error"); }
}
$("tambah-produk").addEventListener("click",()=>bukaForm());
$("batal-form-produk").addEventListener("click",()=>$("dialog-produk-manage").close());
$("cari-produk-manage").addEventListener("input",renderProduk);
$("filter-kategori-manage").addEventListener("change",renderProduk);
document.querySelectorAll("[data-stock-filter]").forEach(button=>button.addEventListener("click",()=>{
  filterStok=button.dataset.stockFilter; document.querySelectorAll("[data-stock-filter]").forEach(b=>b.classList.toggle("active",b===button)); renderProduk();
}));
$("manage-gambar").addEventListener("change",async event=>{
  const file=event.currentTarget.files?.[0]; if(!file)return;
  gambarSedangDiproses=true; $("simpan-form-produk").disabled=true; $("manage-image-status").textContent="Memperkecil foto…";
  try { gambarPerubahan=await KasirImageUtils.kompresKeWebp(file); pratinjau(gambarPerubahan); $("manage-image-status").textContent="Foto siap disimpan."; }
  catch(error){event.currentTarget.value="";$("manage-image-status").textContent=error.message;}
  finally{gambarSedangDiproses=false;$("simpan-form-produk").disabled=false;}
});
$("manage-remove-image").addEventListener("click",()=>{gambarPerubahan="";$("manage-gambar").value="";pratinjau("");$("manage-image-status").textContent="Foto akan dihapus saat disimpan.";});
$("form-produk-manage").addEventListener("submit",async event=>{
  event.preventDefault(); if(!event.currentTarget.reportValidity()||gambarSedangDiproses)return;
  const kode=$("manage-kode").value; const barcode=$("manage-barcode").value.trim();
  const duplicate=produkList.find(p=>p.barcode===barcode&&p.kode!==kode); if(duplicate){pesanProduk(`Barcode sudah digunakan oleh ${duplicate.nama}.`,"error");return;}
  const payload={nama:$("manage-nama").value.trim(),barcode,kategori:$("manage-kategori").value.trim(),harga:Number($("manage-harga").value),stock:Number($("manage-stok").value),...(gambarPerubahan===null?{}:{gambar:gambarPerubahan})};
  try { await api(kode?`/api/products/${encodeURIComponent(kode)}`:"/api/products",{method:kode?"PUT":"POST",body:JSON.stringify(payload)}); $("dialog-produk-manage").close(); await muatProduk(); pesanProduk(`${payload.nama} berhasil disimpan.`,"success"); }
  catch(error){pesanProduk(error.message,"error");}
});
muatProduk();
