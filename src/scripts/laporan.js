const $ = (id) => document.getElementById(id);
const rupiah = (value) => `Rp${Number(value || 0).toLocaleString("id-ID")}`;
const placeholderImage = "assets/images/placeholder-produk.png";
const svgNamespace = "http://www.w3.org/2000/svg";

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

function createSvgElement(tag, attributes = {}) {
  const element = document.createElementNS(svgNamespace, tag);
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, String(value)));
  return element;
}

function niceAxisTicks(maxValue) {
  const safeMax = Math.max(1, maxValue);
  const targetStep = Math.max(1, safeMax / 4);
  const magnitude = 10 ** Math.floor(Math.log10(targetStep));
  const normalized = targetStep / magnitude;
  const multiplier = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  const step = Math.max(1, Math.ceil(multiplier * magnitude));
  const top = step * Math.ceil((safeMax * 1.08) / step);
  const count = Math.round(top / step);
  return Array.from({ length: count + 1 }, (_, index) => Math.max(0, top - step * index));
}

function wrapLabel(value, maxLength = 14) {
  const words = String(value).trim().split(/\s+/);
  const lines = [""];
  words.forEach((word) => {
    const currentLine = lines[lines.length - 1];
    if (currentLine && `${currentLine} ${word}`.length > maxLength && lines.length < 2) {
      lines.push(word);
    } else {
      lines[lines.length - 1] = currentLine ? `${currentLine} ${word}` : word;
    }
  });
  const last = lines.length - 1;
  if (lines[last].length > maxLength) lines[last] = `${lines[last].slice(0, maxLength - 1)}…`;
  return lines;
}

function renderBarChart(target, entries, type) {
  target.replaceChildren();
  if (!entries.length) {
    const message = document.createElement("p");
    message.className = "empty-state";
    message.textContent = type === "products"
      ? "Belum ada produk terjual pada periode ini."
      : "Belum ada data penjualan pada periode ini.";
    target.append(message);
    return;
  }

  const isProducts = type === "products";
  const axisLeft = 92;
  const rightMargin = 24;
  const categoryWidth = isProducts ? 104 : 78;
  const width = Math.max(target.clientWidth, 560, axisLeft + rightMargin + categoryWidth * entries.length);
  const height = isProducts ? 274 : 250;
  const plotTop = isProducts ? 58 : 24;
  const plotHeight = isProducts ? 135 : 145;
  const baseline = plotTop + plotHeight;
  const plotWidth = width - axisLeft - rightMargin;
  const ticks = niceAxisTicks(Math.max(...entries.map((entry) => entry.value)));
  const scaleMax = ticks[0];
  const svg = createSvgElement("svg", {
    class: "report-svg-chart",
    width,
    height,
    viewBox: `0 0 ${width} ${height}`,
    role: "img",
    "aria-label": isProducts
      ? `Grafik batang jumlah unit terjual per produk. ${entries.map((entry) => `${entry.label}: ${entry.value} unit`).join("; ")}`
      : `Grafik batang total penjualan per hari. ${entries.map((entry) => `${entry.label}: ${rupiah(entry.value)}`).join("; ")}`,
  });

  const title = createSvgElement("title");
  title.textContent = isProducts ? "Produk terlaris" : "Penjualan per hari";
  svg.append(title);

  const description = createSvgElement("desc");
  description.textContent = isProducts
    ? "Sumbu X menunjukkan produk, sumbu Y menunjukkan jumlah unit terjual. Garis kisi membantu membandingkan tinggi batang."
    : "Sumbu X menunjukkan tanggal, sumbu Y menunjukkan total penjualan dalam rupiah. Garis kisi membantu membandingkan tinggi batang.";
  svg.append(description);

  const defs = createSvgElement("defs");
  const gradient = createSvgElement("linearGradient", {
    id: `${type}-bar-gradient`,
    x1: "0",
    y1: "0",
    x2: "0",
    y2: "1",
  });
  gradient.append(
    createSvgElement("stop", { offset: "0%", "stop-color": isProducts ? "#56bd88" : "#62a9ed" }),
    createSvgElement("stop", { offset: "100%", "stop-color": isProducts ? "#188455" : "#1769c2" }),
  );
  defs.append(gradient);
  svg.append(defs);

  ticks.forEach((tick, index) => {
    const y = plotTop + (plotHeight * index) / (ticks.length - 1);
    const line = createSvgElement("line", {
      x1: axisLeft,
      y1: y,
      x2: width - rightMargin,
      y2: y,
      class: tick === 0 ? "report-chart-baseline" : "report-chart-gridline",
    });
    svg.append(line);

    const axisLabel = createSvgElement("text", {
      x: axisLeft - 8,
      y: y + (index === 0 ? 10 : index === ticks.length - 1 ? -3 : 4),
      class: "report-chart-tick",
      "text-anchor": "end",
    });
    axisLabel.textContent = isProducts ? tick.toLocaleString("id-ID") : rupiah(tick);
    svg.append(axisLabel);
  });

  svg.append(
    createSvgElement("line", {
      x1: axisLeft,
      y1: plotTop,
      x2: axisLeft,
      y2: baseline,
      class: "report-chart-axis",
    }),
    createSvgElement("line", {
      x1: axisLeft,
      y1: baseline,
      x2: width - rightMargin,
      y2: baseline,
      class: "report-chart-axis",
    }),
  );

  const yAxisTitle = createSvgElement("text", {
    x: 16,
    y: plotTop + plotHeight / 2,
    class: "report-chart-axis-title",
    "text-anchor": "middle",
    transform: `rotate(-90 16 ${plotTop + plotHeight / 2})`,
  });
  yAxisTitle.textContent = isProducts ? "Unit terjual" : "Penjualan (Rp)";
  svg.append(yAxisTitle);

  const slotWidth = plotWidth / entries.length;
  const barWidth = Math.min(isProducts ? 38 : 40, slotWidth * 0.48);
  entries.forEach((entry, index) => {
    const center = axisLeft + slotWidth * (index + 0.5);
    const barHeight = (entry.value / scaleMax) * plotHeight;
    const barY = baseline - barHeight;
    const bar = createSvgElement("rect", {
      x: center - barWidth / 2,
      y: barY,
      width: barWidth,
      height: Math.max(2, barHeight),
      rx: 5,
      class: "report-chart-bar",
      fill: `url(#${type}-bar-gradient)`,
      "aria-label": `${entry.label}: ${isProducts ? `${entry.value} unit terjual` : rupiah(entry.value)}`,
    });
    const barTitle = createSvgElement("title");
    barTitle.textContent = `${entry.label}: ${isProducts ? `${entry.value.toLocaleString("id-ID")} unit terjual` : rupiah(entry.value)}`;
    bar.append(barTitle);
    svg.append(bar);

    const valueLabel = createSvgElement("text", {
      x: center,
      y: Math.max(plotTop + 10, barY - 7),
      class: "report-chart-value",
      "text-anchor": "middle",
    });
    valueLabel.textContent = isProducts
      ? `${entry.value.toLocaleString("id-ID")} unit`
      : rupiah(entry.value);
    svg.append(valueLabel);

    svg.append(createSvgElement("line", {
      x1: center,
      y1: baseline,
      x2: center,
      y2: baseline + 5,
      class: "report-chart-axis",
    }));

    if (isProducts) {
      const imageSource = productsByCode.get(entry.code)?.gambar || placeholderImage;
      const image = createSvgElement("image", {
        x: center - 15,
        y: 10,
        width: 30,
        height: 30,
        href: imageSource,
        preserveAspectRatio: "xMidYMid slice",
        class: "report-chart-product-image",
      });
      image.addEventListener("error", () => image.setAttribute("href", placeholderImage), { once: true });
      svg.append(image);

      const label = createSvgElement("text", {
        x: center,
        y: baseline + 25,
        class: "report-chart-category",
        "text-anchor": "middle",
        "aria-label": entry.label,
      });
      const labelTitle = createSvgElement("title");
      labelTitle.textContent = entry.label;
      label.append(labelTitle);
      wrapLabel(entry.label).forEach((line, lineIndex) => {
        const span = createSvgElement("tspan", {
          x: center,
          dy: lineIndex === 0 ? 0 : 12,
        });
        span.textContent = line;
        label.append(span);
      });
      svg.append(label);
    } else {
      const label = createSvgElement("text", {
        x: center,
        y: baseline + 20,
        class: "report-chart-category",
        "text-anchor": "middle",
      });
      label.textContent = entry.label;
      svg.append(label);
    }
  });

  const xAxisTitle = createSvgElement("text", {
    x: axisLeft + plotWidth / 2,
    y: height - 7,
    class: "report-chart-axis-title",
    "text-anchor": "middle",
  });
  xAxisTitle.textContent = isProducts ? "Produk" : "Tanggal";
  svg.append(xAxisTitle);
  target.replaceChildren(svg);
}

function renderSalesByDay(rows) {
  const dailySales = new Map();
  rows.forEach((transaction) => {
    const key = keyDate(new Date(transaction.waktu));
    dailySales.set(key, (dailySales.get(key) || 0) + Number(transaction.total || 0));
  });

  let chart = [...dailySales.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  if (period === "all") chart = chart.slice(-7);
  $("label-grafik").textContent = period === "all" ? "7 hari terakhir yang memiliki transaksi" : "Berdasarkan periode";
  renderBarChart($("grafik-penjualan"), chart.map(([day, value]) => ({
    label: new Date(`${day}T00:00:00`).toLocaleDateString("id-ID", { day: "2-digit", month: "short" }),
    value,
  })), "sales");
}

function renderTopProducts(rows) {
  const salesByProduct = new Map();
  rows.forEach((transaction) => {
    (transaction.items || []).forEach((item) => {
      const name = String(item.nama || "Produk tanpa nama");
      const code = typeof item.kode === "string" ? item.kode.trim() : "";
      const key = code || `name:${name}`;
      const sale = salesByProduct.get(key) || { code, label: name, value: 0 };
      sale.value += Number(item.qty || 0);
      salesByProduct.set(key, sale);
    });
  });

  const products = [...salesByProduct.values()]
    .filter((product) => Number.isFinite(product.value) && product.value > 0)
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "id"));
  renderBarChart($("produk-terlaris"), products, "products");
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
