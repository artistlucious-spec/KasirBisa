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
function createSvgElement(name, attributes = {}) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  return element;
}
function renderSalesComparison(facts) {
  const section = document.getElementById("insight-trend");
  const message = document.getElementById("insight-trend-message");
  const chartWrap = document.getElementById("insight-trend-chart-wrap");
  const status = document.getElementById("insight-trend-status");
  const chart = document.getElementById("insight-trend-chart");
  const trend = facts.tren_penjualan || {};
  section.hidden = false;
  chart.replaceChildren();

  if (trend.status === "belum_cukup") {
    chartWrap.hidden = true;
    status.hidden = true;
    message.hidden = false;
    message.textContent = "Grafik belum tersedia karena belum ada transaksi pada 7 hari sebelumnya untuk dibandingkan. Lanjutkan mencatat transaksi; perbandingan akan muncul setelah data tersedia.";
    return;
  }

  const previous = Math.max(0, Number(facts.penjualan_7_hari_sebelumnya || 0));
  const current = Math.max(0, Number(facts.penjualan_7_hari || 0));
  const maximum = Math.max(previous, current);
  if (!Number.isFinite(maximum) || maximum <= 0) {
    chartWrap.hidden = true;
    status.hidden = true;
    message.hidden = false;
    message.textContent = "Belum ada nilai penjualan yang bisa digambarkan untuk kedua periode.";
    return;
  }

  message.hidden = true;
  chartWrap.hidden = false;
  status.hidden = false;
  const rawChange = previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;
  const change = Number.isFinite(trend.perubahan_persen) ? trend.perubahan_persen : rawChange;
  const direction = trend.status === "naik"
    ? "Naik"
    : trend.status === "turun"
      ? "Turun"
      : trend.status === "stabil"
        ? "Relatif stabil"
        : "Baru tercatat";
  status.className = `insight-trend-status ${trend.status === "naik" ? "naik" : trend.status === "turun" ? "turun" : "stabil"}`;
  status.textContent = change === null ? direction : `${direction} ${change > 0 ? "+" : ""}${change}%`;

  const xPrevious = 185;
  const xCurrent = 535;
  const baseline = 188;
  const top = 48;
  const scaleMaximum = maximum * 1.2;
  const yPrevious = baseline - (previous / scaleMaximum) * (baseline - top);
  const yCurrent = baseline - (current / scaleMaximum) * (baseline - top);
  const peakX = current >= previous ? xCurrent : xPrevious;
  const peakY = Math.min(yPrevious, yCurrent);
  const middleX = (xPrevious + xCurrent) / 2;
  const curve = `M ${xPrevious} ${yPrevious} C ${middleX - 70} ${yPrevious}, ${middleX + 70} ${yCurrent}, ${xCurrent} ${yCurrent}`;
  const title = createSvgElement("title");
  title.textContent = "Perbandingan penjualan dua periode";
  const description = createSvgElement("desc");
  description.textContent = `Penjualan 7 hari sebelumnya ${rupiah(previous)} dan 7 hari terakhir ${rupiah(current)}. ${direction}. Garis putus-putus menandai nilai tertinggi.`;
  chart.append(title, description);
  chart.append(
    createSvgElement("line", { x1: 72, y1: 66, x2: 72, y2: baseline, class: "insight-trend-axis" }),
    createSvgElement("line", { x1: 72, y1: baseline, x2: 650, y2: baseline, class: "insight-trend-axis" })
  );
  for (const y of [92, 136]) {
    chart.append(createSvgElement("line", { x1: 72, y1: y, x2: 650, y2: y, class: "insight-trend-gridline" }));
  }
  chart.append(
    createSvgElement("line", { x1: 72, y1: peakY, x2: peakX, y2: peakY, class: "insight-trend-peak-guide" }),
    createSvgElement("text", { x: 82, y: Math.max(35, peakY - 9), class: "insight-trend-peak-label" })
  );
  chart.lastElementChild.textContent = "Nilai tertinggi";
  chart.append(createSvgElement("path", { d: curve, class: "insight-trend-curve", "marker-end": "url(#insight-trend-arrow)" }));

  const defs = createSvgElement("defs");
  const marker = createSvgElement("marker", {
    id: "insight-trend-arrow",
    markerWidth: 10,
    markerHeight: 10,
    refX: 8,
    refY: 5,
    orient: "auto",
    markerUnits: "userSpaceOnUse",
  });
  marker.append(createSvgElement("path", { d: "M 0 0 L 10 5 L 0 10 Z", class: "insight-trend-arrowhead" }));
  defs.append(marker);
  chart.prepend(defs);

  chart.append(
    createSvgElement("circle", { cx: xPrevious, cy: yPrevious, r: 7, class: "insight-trend-point" }),
    createSvgElement("circle", { cx: xCurrent, cy: yCurrent, r: 7, class: "insight-trend-point current" }),
    createSvgElement("rect", { x: peakX - 5, y: peakY - 5, width: 10, height: 10, class: "insight-trend-peak-point" }),
    createSvgElement("text", { x: xPrevious, y: 224, "text-anchor": "middle", class: "insight-trend-period-label" }),
    createSvgElement("text", { x: xCurrent, y: 224, "text-anchor": "middle", class: "insight-trend-period-label" })
  );
  chart.children[chart.children.length - 2].textContent = "7 hari sebelumnya";
  chart.children[chart.children.length - 1].textContent = "7 hari terakhir";
  chart.setAttribute("aria-label", description.textContent);
  document.getElementById("insight-trend-previous").textContent = rupiah(previous);
  document.getElementById("insight-trend-current").textContent = rupiah(current);
}
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
  document.getElementById("insight-trend").hidden = false;
  document.getElementById("insight-trend-chart-wrap").hidden = true;
  document.getElementById("insight-trend-status").hidden = true;
  const trendMessage = document.getElementById("insight-trend-message");
  trendMessage.hidden = false;
  trendMessage.textContent = "Menyiapkan perbandingan penjualan...";
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
    renderSalesComparison(facts);
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
    document.getElementById("insight-trend").hidden = false;
    document.getElementById("insight-trend-chart-wrap").hidden = true;
    document.getElementById("insight-trend-status").hidden = true;
    const trendMessage = document.getElementById("insight-trend-message");
    trendMessage.hidden = false;
    trendMessage.textContent = "Grafik perbandingan penjualan belum dapat dimuat.";
    renderRecommendations([]);
  } finally { button.disabled = false; button.innerHTML = '<span aria-hidden="true">✦</span> Buat insight baru'; }
}
focusButtons.forEach((item) => item.addEventListener("click", () => setFocus(item.dataset.focus)));
button.addEventListener("click", generateInsight);
for (const item of focusButtons) { const active = item.dataset.focus === selectedFocus; item.classList.toggle("active", active); item.setAttribute("aria-pressed", String(active)); }
focusDescription.textContent = focusDescriptions[selectedFocus] || focusDescriptions.automatic;
generateInsight();
