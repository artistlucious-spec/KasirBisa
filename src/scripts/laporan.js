const $ = (id) => document.getElementById(id);
const rupiah = (value) => `Rp${Number(value || 0).toLocaleString("id-ID")}`;
const placeholderImage = "assets/images/placeholder-produk.png";

let transactions = [];
let productsByCode = new Map();
let period = "today";

function keyDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function filteredTransactions() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (period === "7") start.setDate(start.getDate() - 6);
  if (period === "30") start.setDate(start.getDate() - 29);
  return transactions.filter((transaction) => period === "all" || new Date(transaction.waktu) >= start);
}

function showNotice(message, isError = false) {
  const notice = $("pesan-laporan");
  notice.textContent = message;
  notice.className = message ? `notice${isError ? " error" : ""}` : "notice";
}

async function fetchArray(url, errorMessage) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  const data = await response.json().catch(() => ({ error: "Respons server tidak valid." }));
  if (response.status === 401) {
    location.replace("login.html");
    throw new Error("Sesi berakhir. Silakan masuk kembali.");
  }
  if (!response.ok) throw new Error(data.error || errorMessage);
  if (!Array.isArray(data)) throw new Error("Format data dari server tidak valid.");
  return data;
}

function renderSalesByDay(rows) {
  const dailySales = new Map();
  rows.forEach((transaction) => {
    const date = new Date(transaction.waktu);
    const key = keyDate(date);
    dailySales.set(key, (dailySales.get(key) || 0) + Number(transaction.total || 0));
  });

  let chart = [...dailySales.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  if (period === "all") chart = chart.slice(-7);
  $("label-grafik").textContent = period === "all" ? "7 hari terakhir yang memiliki transaksi" : "Berdasarkan periode";

  const target = $("grafik-penjualan");
  target.replaceChildren();
  if (!chart.length) {
    const message = document.createElement("p");
    message.className = "empty-state";
    message.textContent = "Belum ada data penjualan pada periode ini.";
    target.append(message);
    return;
  }

  const maxSales = Math.max(...chart.map(([, value]) => value), 1);
  chart.forEach(([day, value]) => {
    const column = document.createElement("div");
    column.className = "chart-column";

    const amount = document.createElement("span");
    amount.className = "chart-value";
    amount.textContent = rupiah(value);

    const barWrap = document.createElement("div");
    barWrap.className = "chart-bar-wrap";

    const bar = document.createElement("div");
    bar.className = "chart-bar";
    bar.style.height = `${Math.max(5, (value / maxSales) * 100)}%`;
    bar.title = rupiah(value);
    barWrap.append(bar);

    const label = document.createElement("small");
    label.textContent = new Date(`${day}T00:00:00`).toLocaleDateString("id-ID", { day: "2-digit", month: "short" });

    column.append(amount, barWrap, label);
    target.append(column);
  });
}

function renderTopProducts(rows) {
  const salesByProduct = new Map();
  rows.forEach((transaction) => {
    (transaction.items || []).forEach((item) => {
      const name = String(item.nama || "Produk tanpa nama");
      const code = typeof item.kode === "string" ? item.kode.trim() : "";
      const key = code || `name:${name}`;
      const sale = salesByProduct.get(key) || { code, name, quantity: 0 };
      sale.quantity += Number(item.qty || 0);
      salesByProduct.set(key, sale);
    });
  });

  const products = [...salesByProduct.values()]
    .filter((product) => Number.isFinite(product.quantity) && product.quantity > 0)
    .sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name, "id"));
  const chart = $("produk-terlaris");
  chart.replaceChildren();

  if (!products.length) {
    const message = document.createElement("p");
    message.className = "empty-state";
    message.textContent = "Belum ada produk terjual pada periode ini.";
    chart.append(message);
    return;
  }

  const maxQuantity = products[0].quantity;
  products.forEach((product) => {
    const column = document.createElement("div");
    column.className = "best-seller-column";
    column.setAttribute("role", "listitem");
    column.setAttribute("aria-label", `${product.name}, ${product.quantity.toLocaleString("id-ID")} unit terjual`);

    const image = document.createElement("img");
    image.className = "best-seller-image";
    image.alt = "";
    image.setAttribute("aria-hidden", "true");
    image.loading = "lazy";
    image.src = productsByCode.get(product.code)?.gambar || placeholderImage;
    image.onerror = () => {
      image.onerror = null;
      image.src = placeholderImage;
    };

    const amount = document.createElement("span");
    amount.className = "best-seller-quantity";
    amount.textContent = `${product.quantity.toLocaleString("id-ID")} unit`;

    const barWrap = document.createElement("div");
    barWrap.className = "best-seller-bar-wrap";
    barWrap.setAttribute("aria-hidden", "true");

    const bar = document.createElement("div");
    bar.className = "best-seller-bar";
    bar.style.height = `${Math.max(5, (product.quantity / maxQuantity) * 100)}%`;
    bar.title = `${product.name}: ${product.quantity.toLocaleString("id-ID")} unit`;
    barWrap.append(bar);

    const name = document.createElement("span");
    name.className = "best-seller-name";
    name.textContent = product.name;
    name.title = product.name;

    column.append(image, amount, barWrap, name);
    chart.append(column);
  });
}

function render() {
  const rows = filteredTransactions();
  $("laporan-jumlah").textContent = rows.length.toLocaleString("id-ID");
  $("laporan-total").textContent = rupiah(rows.reduce((sum, transaction) => sum + Number(transaction.total || 0), 0));
  renderSalesByDay(rows);
  renderTopProducts(rows);
}

document.querySelectorAll("[data-report-period]").forEach((button) => {
  button.addEventListener("click", () => {
    period = button.dataset.reportPeriod;
    document.querySelectorAll("[data-report-period]").forEach((periodButton) => {
      periodButton.classList.toggle("active", periodButton === button);
    });
    render();
  });
});

async function loadReportData() {
  const productsRequest = fetchArray("/api/products", "Data foto produk tidak dapat dimuat.")
    .catch((error) => {
      showNotice(`Foto produk tidak dapat dimuat: ${error.message}. Grafik tetap ditampilkan dengan gambar cadangan.`, true);
      return [];
    });

  try {
    const [transactionData, productData] = await Promise.all([
      fetchArray("/api/transactions", "Data laporan tidak dapat dimuat."),
      productsRequest,
    ]);
    transactions = transactionData;
    productsByCode = new Map(productData
      .filter((product) => product && typeof product.kode === "string")
      .map((product) => [product.kode, product]));
  } catch (error) {
    showNotice(`Laporan belum dapat dimuat: ${error.message}`, true);
  }
  render();
}

loadReportData();
