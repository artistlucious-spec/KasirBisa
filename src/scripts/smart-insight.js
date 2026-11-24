// Smart Insight Hybrid: fokus pemilik + rekomendasi deterministik dari data toko.
const button = document.getElementById("buat-insight");
const notice = document.getElementById("insight-notice");
const keyArea = document.getElementById("api-key-area");
const focusButtons = [...document.querySelectorAll("[data-focus]")];
const focusDescription = document.getElementById("insight-focus-description");
const focusDescriptions = {
  automatic: "Kami mencari peluang dan risiko paling penting dari data usaha Anda.",
  sales: "Kami memprioritaskan tren penjualan dan tindakan yang dapat membantu menjaga atau meningkatkan transaksi.",
  stock: "Kami memprioritaskan produk yang berisiko habis berdasarkan laju penjualan dan stok saat ini.",
  best_sellers: "Kami menyoroti produk yang paling banyak dibeli pelanggan dalam periode terbaru.",
  slow_movers: "Kami membantu menemukan stok yang belum bergerak agar pemilik dapat mengevaluasi pembelian berikutnya.",
};
let selectedFocus = "automatic";
try { selectedFocus = localStorage.getItem("kasirbisa-insight-focus") || "automatic"; } catch {}
if (!Object.hasOwn(focusDescriptions, selectedFocus)) selectedFocus = "automatic";

function rupiah(value) { return "Rp" + Number(value || 0).toLocaleString("id-ID"); }
function setNotice(text, type = "") { notice.textContent = text; notice.className = "notice" + (type ? ` ${type}` : ""); }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]); }
function setFocus(focus) {
  selectedFocus = focus;
  try { localStorage.setItem("kasirbisa-insight-focus", focus); } catch {}
  for (const item of focusButtons) {
    const active = item.dataset.focus === focus;
    item.classList.toggle("active", active);
    item.setAttribute("aria-pressed", String(active));
  }
  focusDescription.textContent = focusDescriptions[focus] || focusDescriptions.automatic;
  generateInsight();
}
function renderRecommendations(items) {
  const target = document.getElementById("insight-recommendations");
  target.replaceChildren();
  if (!Array.isArray(items) || !items.length) {
    target.innerHTML = '<p class="empty-state">Belum ada rekomendasi khusus. Lanjutkan pencatatan transaksi agar sistem memiliki data yang cukup.</p>';
    return;
  }
  const labels = { tinggi: "Perlu segera diperiksa", sedang: "Perlu diperhatikan", informasi: "Informasi" };
  for (const item of items) {
    const article = document.createElement("article");
    article.className = `insight-recommendation ${item.priority || "informasi"}`;
    const head = document.createElement("div"); head.className = "insight-recommendation-head";
    const title = document.createElement("h3"); title.textContent = item.title || "Rekomendasi usaha";
    const badge = document.createElement("span"); badge.className = `insight-priority ${item.priority || "informasi"}`; badge.textContent = labels[item.priority] || labels.informasi;
    head.append(title, badge);
    const evidence = document.createElement("p"); evidence.className = "insight-evidence"; evidence.textContent = item.evidence || "Belum ada bukti tambahan.";
    const action = document.createElement("div"); action.className = "insight-action";
    const actionLabel = document.createElement("strong"); actionLabel.textContent = "Yang bisa dilakukan";
    const actionText = document.createElement("p"); actionText.textContent = item.action || "Periksa kondisi usaha secara langsung.";
    action.append(actionLabel, actionText);
    const reason = document.createElement("small"); reason.textContent = item.reason || "";
    article.append(head, evidence, action, reason); target.append(article);
  }
}
async function generateInsight() {
  button.disabled = true; button.textContent = "Menganalisis data..."; keyArea.hidden = true;
  setNotice("Membaca transaksi, pergerakan produk, dan kondisi stok...");
  document.getElementById("insight-ringkasan").textContent = "Analisis sedang disiapkan...";
  document.getElementById("insight-recommendations").innerHTML = '<p class="empty-state">Menyusun rekomendasi berdasarkan data...</p>';
  try {
    const response = await fetch("/api/smart-insight", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ focus: selectedFocus }) });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) { window.location.replace("/login.html"); return; }
    if (!response.ok && !data.insight) throw new Error(data.detail || data.error || "Smart Insight tidak dapat diproses.");
    const insight = data.insight || {};
    document.getElementById("insight-ringkasan").innerHTML = `<p>${escapeHtml(insight.ringkasan || "Belum ada ringkasan.")}</p>`;
    document.getElementById("insight-produk").textContent = insight.produk_terlaris || "Belum tersedia";
    document.getElementById("insight-stok").textContent = insight.stok_menipis || "Belum tersedia";
    document.getElementById("insight-jam").textContent = insight.jam_ramai || "Belum tersedia";
    document.getElementById("insight-saran").textContent = insight.saran_penjualan || "Belum tersedia";
    renderRecommendations(data.recommendations || []);
    const cards = Array.isArray(insight.kartu) ? insight.kartu : [];
    const grid = document.getElementById("insight-kartu"); grid.replaceChildren();
    for (const card of cards) {
      const article = document.createElement("article"); article.className = `insight-mini-card ${card.tipe || "info"}`;
      const title = document.createElement("span"); title.textContent = card.judul || "Ringkasan";
      const value = document.createElement("strong"); value.textContent = card.isi || "-";
      article.append(title, value); grid.append(article);
    }
    const facts = data.facts || {};
    document.getElementById("fact-transaksi").textContent = String(facts.jumlah_transaksi || 0);
    document.getElementById("fact-total").textContent = rupiah(facts.total_penjualan);
    document.getElementById("fact-produk").textContent = facts.produk_terlaris_7_hari?.[0]?.nama || facts.produk_terlaris?.[0]?.name || "-";
    document.getElementById("fact-stok").textContent = String((facts.risiko_stok || facts.stok_menipis || []).length);
    if (data.needs_key) {
      keyArea.hidden = false;
      const detail = document.getElementById("insight-setup-detail"); if (detail) detail.textContent = data.setup || "Pengelola dapat mengaktifkan layanan AI.";
      setNotice("Rekomendasi berbasis data aktif. AI tambahan belum diaktifkan oleh pengelola.", "success");
    } else if (data.success) setNotice("Analisis terbaru berhasil dibuat dari data usaha Anda.", "success");
    else setNotice(data.detail || "Rekomendasi berbasis data ditampilkan tanpa bantuan AI.", "success");
  } catch (error) {
    setNotice(error.message, "error");
    document.getElementById("insight-ringkasan").textContent = "Smart Insight belum dapat dimuat.";
    renderRecommendations([]);
  } finally { button.disabled = false; button.innerHTML = '<span aria-hidden="true">✦</span> Buat insight baru'; }
}
focusButtons.forEach((item) => item.addEventListener("click", () => setFocus(item.dataset.focus)));
button.addEventListener("click", generateInsight);
for (const item of focusButtons) { const active = item.dataset.focus === selectedFocus; item.classList.toggle("active", active); item.setAttribute("aria-pressed", String(active)); }
focusDescription.textContent = focusDescriptions[selectedFocus] || focusDescriptions.automatic;
generateInsight();
