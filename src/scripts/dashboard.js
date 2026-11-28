const rupiah = (value) => `Rp${Number(value || 0).toLocaleString("id-ID")}`;
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char]));

function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function setNotice(message, isError = false) {
  const notice = document.getElementById("dashboard-notice");
  notice.textContent = message;
  notice.className = message ? `notice${isError ? " error" : ""}` : "notice";
}

async function fetchJson(url, errorMessage) {
  const response = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    location.replace("login.html");
    throw new Error("Sesi berakhir.");
  }
  if (!response.ok) throw new Error(data.error || errorMessage);
  return data;
}

function transactionDate(transaction) {
  const date = new Date(transaction.waktu);
  return Number.isNaN(date.getTime()) ? null : date;
}

function renderChart(transactions) {
  const chart = document.getElementById("dashboard-chart");
  const totals = new Map();
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - offset);
    totals.set(localDateKey(date), { date, total: 0 });
  }
  transactions.forEach((transaction) => {
    const date = transactionDate(transaction);
    if (!date) return;
    const row = totals.get(localDateKey(date));
    if (row) row.total += Number(transaction.total || 0);
  });

  const entries = [...totals.values()];
  const max = Math.max(1, ...entries.map((entry) => entry.total));
  chart.innerHTML = entries.map((entry) => {
    const height = Math.round((entry.total / max) * 100);
    const label = entry.date.toLocaleDateString("id-ID", { weekday: "short" }).replace(".", "");
    return `<div class="dashboard-bar-column" title="${escapeHtml(`${label}: ${rupiah(entry.total)}`)}">
      <span class="dashboard-bar-value">${entry.total ? rupiah(entry.total) : ""}</span>
      <div class="dashboard-bar-track"><div class="dashboard-bar" style="height:${height}%"></div></div>
      <span class="dashboard-bar-label">${escapeHtml(label)}</span>
    </div>`;
  }).join("");
}

function renderTopProducts(transactions) {
  const sales = new Map();
  transactions.forEach((transaction) => {
    (transaction.items || []).forEach((item) => {
      const name = String(item.nama || "Produk tanpa nama");
      const code = String(item.kode || name);
      const row = sales.get(code) || { name, qty: 0 };
      row.qty += Number(item.qty || 0);
      sales.set(code, row);
    });
  });
  const rows = [...sales.values()].sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name, "id")).slice(0, 5);
  const target = document.getElementById("dashboard-top-products");
  target.innerHTML = rows.length ? rows.map((row, index) => `
    <div class="dashboard-list-row">
      <span class="dashboard-rank">${index + 1}</span>
      <strong>${escapeHtml(row.name)}</strong>
      <span>${row.qty.toLocaleString("id-ID")} unit</span>
    </div>`).join("") : '<p class="empty-state">Belum ada produk terjual.</p>';
}

function renderLowStock(products) {
  const rows = products
    .filter((product) => Number(product.stok || 0) <= 5)
    .sort((a, b) => Number(a.stok || 0) - Number(b.stok || 0) || String(a.nama).localeCompare(String(b.nama), "id"))
    .slice(0, 5);
  document.getElementById("dashboard-low-stock").textContent = `${products.filter((product) => Number(product.stok || 0) <= 5).length} produk`;
  const target = document.getElementById("dashboard-low-stock-list");
  target.innerHTML = rows.length ? rows.map((product) => `
    <div class="dashboard-list-row">
      <span class="dashboard-stock-dot" aria-hidden="true"></span>
      <strong>${escapeHtml(product.nama || "Produk")}</strong>
      <span class="dashboard-stock-count">${Number(product.stok || 0)} tersisa</span>
    </div>`).join("") : '<p class="empty-state">Stok produk dalam kondisi aman.</p>';
}

function renderAlerts(data) {
  const alerts = (data.alerts || []).filter((alert) => ["baru", "dibaca", "ditangani"].includes(alert.status)).slice(0, 5);
  document.getElementById("dashboard-alerts").textContent = String(alerts.length);
  const target = document.getElementById("dashboard-alert-list");
  target.innerHTML = alerts.length ? alerts.map((alert) => `
    <div class="dashboard-alert-row">
      <span class="dashboard-alert-priority ${escapeHtml(alert.priority)}" aria-hidden="true"></span>
      <div><strong>${escapeHtml(alert.title)}</strong><small>${escapeHtml(alert.category)} · ${escapeHtml(alert.status)}</small></div>
    </div>`).join("") : '<p class="empty-state">Tidak ada perhatian aktif.</p>';
}

async function loadDashboard() {
  setNotice("Memuat ringkasan usaha...");
  try {
    const [transactions, products, alerts] = await Promise.all([
      fetchJson("/api/transactions", "Data transaksi tidak dapat dimuat."),
      fetchJson("/api/products", "Data produk tidak dapat dimuat."),
      fetchJson("/api/store-alerts", "Pusat perhatian tidak dapat dimuat."),
    ]);

    const todayKey = localDateKey(new Date());
    const todayRows = transactions.filter((transaction) => {
      const date = transactionDate(transaction);
      return date && localDateKey(date) === todayKey;
    });
    document.getElementById("dashboard-sales").textContent = rupiah(todayRows.reduce((sum, transaction) => sum + Number(transaction.total || 0), 0));
    document.getElementById("dashboard-transactions").textContent = String(todayRows.length);
    renderChart(transactions);
    renderTopProducts(transactions);
    renderLowStock(products);
    renderAlerts(alerts);
    setNotice("");
  } catch (error) {
    setNotice(`Dashboard belum dapat dimuat: ${error.message}`, true);
  }
}

const dateText = new Date().toLocaleDateString("id-ID", {
  weekday: "long", year: "numeric", month: "long", day: "numeric",
});
document.getElementById("dashboard-date").textContent = dateText;
if (window.kasirSessionData?.businessName) {
  document.getElementById("dashboard-greeting").textContent = `Selamat datang, ${window.kasirSessionData.businessName}`;
}
if (window.kasirSessionPromise) window.kasirSessionPromise.then(() => {
  if (window.kasirSessionData?.businessName) {
    document.getElementById("dashboard-greeting").textContent = `Selamat datang, ${window.kasirSessionData.businessName}`;
  }
});
loadDashboard();
