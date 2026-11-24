const statusMessage = document.getElementById("admin-status");
const dashboard = document.getElementById("admin-dashboard");
const pageSize = 50;
const moneyFormatter = new Intl.NumberFormat("id-ID");

const states = {
  accounts: { items: [], offset: 0, total: 0, query: "", loading: false, loaded: false, timer: null },
  products: { items: [], offset: 0, total: 0, query: "", loading: false, loaded: false, timer: null },
  transactions: { items: [], offset: 0, total: 0, query: "", loading: false, loaded: false, timer: null },
  payments: { items: [], offset: 0, total: 0, query: "", loading: false, loaded: false, timer: null },
  alerts: { items: [], offset: 0, total: 0, query: "", loading: false, loaded: false, timer: null },
};

const resourceConfig = {
  products: {
    body: "admin-product-list",
    count: "admin-products-count",
    more: "admin-products-more",
    refresh: "admin-products-refresh",
    search: "admin-products-search",
    endpoint: "products",
    emptyColumns: 7,
  },
  transactions: {
    body: "admin-transaction-list",
    count: "admin-transactions-count",
    more: "admin-transactions-more",
    refresh: "admin-transactions-refresh",
    search: "admin-transactions-search",
    endpoint: "transactions",
    emptyColumns: 7,
  },
  payments: {
    body: "admin-payment-list",
    count: "admin-payments-count",
    more: "admin-payments-more",
    refresh: "admin-payments-refresh",
    search: "admin-payments-search",
    endpoint: "payments",
    emptyColumns: 5,
  },
  alerts: {
    body: "admin-alert-list",
    count: "admin-alerts-count",
    more: "admin-alerts-more",
    refresh: "admin-alerts-refresh",
    search: "admin-alerts-search",
    endpoint: "alerts",
    emptyColumns: 6,
  },
};

function showStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.className = `notice${isError ? " error" : ""}`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function money(value) {
  return `Rp${moneyFormatter.format(Number(value) || 0)}`;
}

function formatDate(value, withTime = false) {
  if (!value) return "-";
  const raw = String(value);
  const date = new Date(raw.includes("T") ? raw : `${raw.replace(" ", "T")}Z`);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat("id-ID", withTime
    ? { dateStyle: "medium", timeStyle: "short" }
    : { dateStyle: "medium" }).format(date);
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { Accept: "application/json", ...(options.headers || {}) },
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    window.location.replace("/login.html");
    throw new Error("Sesi login berakhir. Silakan masuk kembali.");
  }
  if (!response.ok) throw new Error(data.error || "Permintaan tidak berhasil.");
  return data;
}

function updateSummary(summary = {}) {
  document.getElementById("jumlah-akun").textContent = String(summary.total || 0);
  document.getElementById("jumlah-aktif").textContent = String(summary.active || 0);
  document.getElementById("jumlah-nonaktif").textContent = String(summary.disabled || 0);
}

function renderAccounts() {
  const list = document.getElementById("admin-account-list");
  if (!states.accounts.items.length) {
    list.innerHTML = '<tr><td class="admin-empty" colspan="7">Tidak ada akun yang cocok.</td></tr>';
    return;
  }
  list.innerHTML = states.accounts.items.map((account) => `
    <tr>
      <td>${escapeHtml(account.businessName || "-")}</td>
      <td>${escapeHtml(account.username || "-")}</td>
      <td>${escapeHtml(account.whatsapp || "-")}</td>
      <td>${escapeHtml(formatDate(account.createdAt))}</td>
      <td>${Number(account.productCount) || 0} produk / ${Number(account.transactionCount) || 0} transaksi</td>
      <td><span class="admin-status-badge ${account.active ? "active" : "inactive"}">${account.active ? "Aktif" : "Nonaktif"}</span></td>
      <td class="admin-actions-cell">
        <button class="secondary-button admin-account-action" type="button" data-product-create="${escapeHtml(account.id)}">Tambah produk</button>
        <button class="secondary-button admin-account-action" type="button" data-account-edit="${escapeHtml(account.id)}" ${account.isAdmin ? "disabled" : ""}>Ubah nama usaha</button>
        <button class="${account.active ? "secondary-button" : "primary-button"} admin-account-action" type="button" data-account-id="${escapeHtml(account.id)}" data-next-active="${!account.active}" ${account.isAdmin ? "disabled" : ""}>${account.isAdmin ? "Admin utama" : account.active ? "Nonaktifkan" : "Aktifkan"}</button>
      </td>
    </tr>`).join("");
}

async function loadAccounts(reset = false) {
  const state = states.accounts;
  if (state.loading) return;
  if (reset) {
    state.offset = 0;
    state.items = [];
  }
  state.loading = true;
  document.getElementById("admin-refresh").disabled = true;
  document.getElementById("admin-load-more").disabled = true;
  if (!state.items.length) showStatus("Memuat daftar akun...");

  const params = new URLSearchParams({ offset: String(state.offset) });
  if (state.query) params.set("q", state.query);
  try {
    const data = await requestJson(`/api/admin/accounts?${params}`);
    if (!Array.isArray(data.accounts)) {
      throw new Error("Format daftar akun tidak sesuai. Pastikan API admin/accounts dan worker.js versi terbaru sudah di-deploy.");
    }
    state.items = reset ? data.accounts : [...state.items, ...data.accounts];
    state.total = Number(data.total) || 0;
    state.offset += data.accounts.length;
    state.loaded = true;
    updateSummary(data.summary);
    renderAccounts();
    document.getElementById("admin-result-count").textContent =
      `Menampilkan ${state.items.length} dari ${state.total} akun yang cocok.`;
    document.getElementById("admin-load-more").hidden = state.items.length >= state.total;
    showStatus("Data akun berhasil dimuat.");
  } catch (error) {
    showStatus(error.message || "Daftar akun tidak dapat dimuat.", true);
    if (!state.items.length) renderAccounts();
  } finally {
    state.loading = false;
    document.getElementById("admin-refresh").disabled = false;
    document.getElementById("admin-load-more").disabled = false;
  }
}

function emptyTable(resource, message) {
  const config = resourceConfig[resource];
  document.getElementById(config.body).innerHTML =
    `<tr><td class="admin-empty" colspan="${config.emptyColumns}">${escapeHtml(message)}</td></tr>`;
}

function renderProducts() {
  const list = document.getElementById("admin-product-list");
  if (!states.products.items.length) {
    emptyTable("products", "Tidak ada produk yang cocok.");
    return;
  }
  list.innerHTML = states.products.items.map((item, index) => `
    <tr>
      <td>${escapeHtml(item.businessName)}<small class="admin-cell-subtitle">@${escapeHtml(item.username)}</small></td>
      <td>${escapeHtml(item.name)}</td>
      <td>${escapeHtml(item.code)}<small class="admin-cell-subtitle">${escapeHtml(item.barcode)}</small></td>
      <td>${escapeHtml(item.category)}</td>
      <td>${money(item.price)}</td>
      <td><span class="admin-status-badge ${item.stock <= 5 ? "inactive" : "active"}">${Number(item.stock)}</span></td>
      <td><button class="secondary-button admin-account-action" type="button" data-product-edit="${index}">Ubah</button></td>
    </tr>`).join("");
}

function renderTransactions() {
  const list = document.getElementById("admin-transaction-list");
  if (!states.transactions.items.length) {
    emptyTable("transactions", "Tidak ada transaksi yang cocok.");
    return;
  }
  list.innerHTML = states.transactions.items.map((item, index) => `
    <tr>
      <td>${escapeHtml(formatDate(item.time, true))}</td>
      <td>${escapeHtml(item.businessName)}<small class="admin-cell-subtitle">@${escapeHtml(item.username)}</small></td>
      <td class="admin-id-cell">${escapeHtml(item.id)}</td>
      <td>${Number(item.itemCount) || 0}</td>
      <td>${item.paymentMethod === "qris" ? "QRIS" : "Tunai"}</td>
      <td>${money(item.total)}</td>
      <td><button class="secondary-button admin-account-action" type="button" data-transaction-detail="${index}">Lihat</button></td>
    </tr>`).join("");
}

function renderPayments() {
  const list = document.getElementById("admin-payment-list");
  if (!states.payments.items.length) {
    emptyTable("payments", "Tidak ada usaha yang cocok.");
    return;
  }
  list.innerHTML = states.payments.items.map((item, index) => `
    <tr>
      <td>${escapeHtml(item.businessName)}</td>
      <td>@${escapeHtml(item.username)}</td>
      <td><span class="admin-status-badge ${item.hasImage ? "active" : "inactive"}">${item.hasImage ? "Tersimpan" : "Belum ada"}</span></td>
      <td><span class="admin-status-badge ${item.qrisEnabled ? "active" : "inactive"}">${item.qrisEnabled ? "Aktif" : "Nonaktif"}</span></td>
      <td class="admin-actions-cell">
        ${item.hasImage ? `<button class="secondary-button admin-account-action" type="button" data-payment-view="${index}">Lihat QR</button>` : ""}
        <button class="${item.qrisEnabled ? "secondary-button" : "primary-button"} admin-account-action" type="button" data-payment-toggle="${index}" ${item.qrisEnabled || item.hasImage ? "" : "disabled"}>${item.qrisEnabled ? "Nonaktifkan QRIS" : "Aktifkan QRIS"}</button>
      </td>
    </tr>`).join("");
}

const alertStatusLabels = {
  baru: "Baru",
  dibaca: "Dibaca",
  ditangani: "Ditangani",
  selesai: "Selesai",
  tidak_relevan: "Tidak relevan",
};

function renderAlerts() {
  const list = document.getElementById("admin-alert-list");
  if (!states.alerts.items.length) {
    emptyTable("alerts", "Belum ada perhatian yang tercatat.");
    return;
  }
  list.innerHTML = states.alerts.items.map((item, index) => {
    const active = ["baru", "dibaca", "ditangani"].includes(item.status);
    return `<tr>
      <td><span class="admin-status-badge ${item.priority === "tinggi" ? "inactive" : "active"}">${escapeHtml(item.priority)}</span></td>
      <td>${escapeHtml(item.businessName)}</td>
      <td><strong>${escapeHtml(item.title)}</strong><small class="admin-cell-subtitle">${escapeHtml(item.message)}</small></td>
      <td>${escapeHtml(alertStatusLabels[item.status] || item.status)}</td>
      <td>${escapeHtml(formatDate(item.createdAt, true))}</td>
      <td class="admin-actions-cell">${active
        ? `<button class="secondary-button admin-account-action" type="button" data-alert-status="${index}" data-status="selesai">Tandai selesai</button><button class="text-button" type="button" data-alert-status="${index}" data-status="tidak_relevan">Tidak relevan</button>`
        : "—"}</td>
    </tr>`;
  }).join("");
}

const renderers = {
  products: renderProducts,
  transactions: renderTransactions,
  payments: renderPayments,
  alerts: renderAlerts,
};

async function loadResource(resource, reset = false) {
  const state = states[resource];
  const config = resourceConfig[resource];
  if (state.loading) return;
  if (reset) {
    state.offset = 0;
    state.items = [];
  }
  state.loading = true;
  document.getElementById(config.refresh).disabled = true;
  document.getElementById(config.more).disabled = true;
  if (!state.items.length) emptyTable(resource, "Memuat data...");

  const params = new URLSearchParams({ resource: config.endpoint, offset: String(state.offset) });
  if (state.query) params.set("q", state.query);
  try {
    const data = await requestJson(`/api/admin/data?${params}`);
    if (!Array.isArray(data.items)) {
      throw new Error("Format data admin tidak sesuai. Pastikan API /api/admin/data dan worker.js versi terbaru sudah di-deploy bersama halaman.");
    }
    state.items = reset ? data.items : [...state.items, ...data.items];
    state.total = Number(data.total) || 0;
    state.offset += data.items.length;
    state.loaded = true;
    renderers[resource]();
    document.getElementById(config.count).textContent =
      `Menampilkan ${state.items.length} dari ${state.total} data.`;
    document.getElementById(config.more).hidden = state.items.length >= state.total;
    if (resource === "products") {
      document.getElementById("admin-product-total").textContent = String(data.summary?.total || 0);
      document.getElementById("admin-low-stock").textContent = String(data.summary?.lowStock || 0);
    }
    if (resource === "transactions") {
      document.getElementById("admin-transaction-total").textContent = moneyFormatter.format(data.summary?.count || 0);
      document.getElementById("admin-sales-total").textContent = money(data.summary?.sales || 0);
    }
    showStatus("Data berhasil dimuat.");
  } catch (error) {
    showStatus(error.message || "Data tidak dapat dimuat.", true);
    if (!state.items.length) emptyTable(resource, "Data belum dapat dimuat. Periksa koneksi lalu coba lagi.");
  } finally {
    state.loading = false;
    document.getElementById(config.refresh).disabled = false;
    document.getElementById(config.more).disabled = false;
  }
}

async function saveAccountStatus(button) {
  const nextActive = button.dataset.nextActive === "true";
  const action = nextActive ? "mengaktifkan" : "menonaktifkan";
  if (!window.confirm(`Yakin ingin ${action} akun ini? Pengguna yang sedang masuk akan diminta masuk kembali.`)) return;
  button.disabled = true;
  try {
    await requestJson("/api/admin/accounts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: button.dataset.accountId, active: nextActive }),
    });
    await loadAccounts(true);
    showStatus(nextActive ? "Akun berhasil diaktifkan." : "Akun berhasil dinonaktifkan.");
  } catch (error) {
    button.disabled = false;
    showStatus(error.message, true);
  }
}

async function renameBusiness(button) {
  const account = states.accounts.items.find((item) => item.id === button.dataset.accountEdit);
  if (!account) return;
  const businessName = window.prompt("Masukkan nama usaha baru:", account.businessName || "");
  if (businessName === null) return;
  if (!businessName.trim() || businessName.trim().length > 120) {
    showStatus("Nama usaha wajib diisi dan maksimal 120 karakter.", true);
    return;
  }
  button.disabled = true;
  try {
    await requestJson("/api/admin/accounts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: account.id, businessName: businessName.trim() }),
    });
    await loadAccounts(true);
    showStatus("Nama usaha berhasil diperbarui.");
  } catch (error) {
    button.disabled = false;
    showStatus(error.message, true);
  }
}

function openProductDialog(item, create = false) {
  const dialog = document.getElementById("admin-product-dialog");
  dialog.dataset.mode = create ? "create" : "edit";
  document.getElementById("admin-product-dialog-title").textContent =
    create ? "Tambah produk" : "Ubah produk dan stok";
  document.getElementById("admin-product-business").textContent =
    `${item.businessName} (@${item.username})${item.code ? ` · ${item.code}` : ""}`;
  document.getElementById("admin-product-business-id").value = item.businessId;
  document.getElementById("admin-product-code").value = item.code || "";
  document.getElementById("admin-product-name").value = item.name || "";
  document.getElementById("admin-product-barcode").value = item.barcode || "";
  document.getElementById("admin-product-category").value = item.category || "";
  document.getElementById("admin-product-price").value = item.price || "";
  document.getElementById("admin-product-stock").value = item.stock ?? 0;
  document.getElementById("admin-product-save").textContent = create ? "Tambah produk" : "Simpan perubahan";
  document.getElementById("admin-product-error").textContent = "";
  dialog.showModal();
}

document.getElementById("admin-product-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const saveButton = document.getElementById("admin-product-save");
  const errorEl = document.getElementById("admin-product-error");
  const body = {
    businessId: document.getElementById("admin-product-business-id").value,
    code: document.getElementById("admin-product-code").value,
    name: document.getElementById("admin-product-name").value.trim(),
    barcode: document.getElementById("admin-product-barcode").value.trim(),
    category: document.getElementById("admin-product-category").value.trim(),
    price: Number(document.getElementById("admin-product-price").value),
    stock: Number(document.getElementById("admin-product-stock").value),
  };
  saveButton.disabled = true;
  errorEl.textContent = "";
  try {
    const create = document.getElementById("admin-product-dialog").dataset.mode === "create";
    await requestJson("/api/admin/data?resource=products", {
      method: create ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    document.getElementById("admin-product-dialog").close();
    await loadResource("products", true);
    showStatus(create ? "Produk berhasil ditambahkan." : "Data produk berhasil diperbarui.");
  } catch (error) {
    errorEl.textContent = error.message || "Perubahan produk tidak berhasil disimpan.";
    errorEl.className = "notice error";
  } finally {
    saveButton.disabled = false;
  }
});

async function showTransaction(index) {
  const item = states.transactions.items[index];
  if (!item) return;
  const content = document.getElementById("admin-transaction-detail");
  const heading = document.getElementById("admin-transaction-heading");
  heading.textContent = item.id;
  content.innerHTML = '<p class="empty-state">Memuat rincian transaksi...</p>';
  document.getElementById("admin-transaction-dialog").showModal();
  try {
    const params = new URLSearchParams({ resource: "transaction", id: item.id });
    const detail = await requestJson(`/api/admin/data?${params}`);
    content.innerHTML = `
      <p><strong>Usaha:</strong> ${escapeHtml(detail.business_name)} (@${escapeHtml(detail.username)})</p>
      <p><strong>Waktu:</strong> ${escapeHtml(formatDate(detail.waktu, true))}</p>
      <p><strong>Metode:</strong> ${detail.paymentMethod === "qris" ? "QRIS" : "Tunai"} · <strong>Member:</strong> ${detail.member ? "Ya" : "Tidak"}</p>
      <div class="admin-table-scroll"><table class="admin-table admin-detail-table">
        <thead><tr><th>Produk</th><th>Jumlah</th><th>Harga</th><th>Subtotal</th></tr></thead>
        <tbody>${detail.items.map((product) => `<tr><td>${escapeHtml(product.name)}<small class="admin-cell-subtitle">${escapeHtml(product.code)}</small></td><td>${Number(product.qty)}</td><td>${money(product.price)}</td><td>${money(product.price * product.qty)}</td></tr>`).join("")}</tbody>
      </table></div>
      <dl class="admin-transaction-totals">
        <div><dt>Subtotal</dt><dd>${money(detail.subtotal)}</dd></div>
        <div><dt>Diskon</dt><dd>${money(detail.diskon)}</dd></div>
        <div><dt>PPN</dt><dd>${money(detail.ppn)}</dd></div>
        <div><dt>Total</dt><dd>${money(detail.total)}</dd></div>
        <div><dt>Dibayar</dt><dd>${money(detail.dibayar)}</dd></div>
        <div><dt>Kembalian</dt><dd>${money(detail.kembalian)}</dd></div>
      </dl>`;
  } catch (error) {
    content.textContent = error.message || "Rincian transaksi tidak dapat dimuat.";
  }
}

async function showPaymentQr(index) {
  const item = states.payments.items[index];
  if (!item) return;
  const content = document.getElementById("admin-qr-content");
  document.getElementById("admin-qr-heading").textContent = item.businessName;
  content.innerHTML = '<p class="empty-state">Memuat QR...</p>';
  document.getElementById("admin-qr-dialog").showModal();
  try {
    const params = new URLSearchParams({ resource: "payment", businessId: item.businessId });
    const detail = await requestJson(`/api/admin/data?${params}`);
    const image = detail.qrisImage || "";
    if (!/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(image)) {
      throw new Error("Data QR usaha tidak memiliki format gambar yang dapat ditampilkan.");
    }
    content.innerHTML = `<p>QRIS ${detail.qrisEnabled ? "aktif" : "nonaktif"}</p><img class="admin-qr-image" src="${image}" alt="QR pembayaran milik ${escapeHtml(detail.businessName)}">`;
  } catch (error) {
    content.textContent = error.message || "QR tidak dapat dimuat.";
  }
}

async function togglePayment(index, button) {
  const item = states.payments.items[index];
  if (!item) return;
  const nextEnabled = !item.qrisEnabled;
  if (!window.confirm(`${nextEnabled ? "Aktifkan" : "Nonaktifkan"} QRIS untuk usaha ${item.businessName}?`)) return;
  button.disabled = true;
  try {
    await requestJson("/api/admin/data?resource=payments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId: item.businessId, qrisEnabled: nextEnabled }),
    });
    await loadResource("payments", true);
    showStatus(`QRIS berhasil ${nextEnabled ? "diaktifkan" : "dinonaktifkan"}.`);
  } catch (error) {
    button.disabled = false;
    showStatus(error.message || "Pengaturan QRIS tidak dapat diubah.", true);
  }
}

async function updateAlert(index, status, button) {
  const item = states.alerts.items[index];
  if (!item) return;
  button.disabled = true;
  try {
    await requestJson("/api/admin/data?resource=alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, businessId: item.businessId, status }),
    });
    await loadResource("alerts", true);
    showStatus("Status perhatian berhasil diperbarui.");
  } catch (error) {
    button.disabled = false;
    showStatus(error.message || "Status perhatian tidak dapat diperbarui.", true);
  }
}

document.getElementById("admin-account-list").addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button || button.disabled) return;
  if (button.hasAttribute("data-account-id")) saveAccountStatus(button);
  if (button.hasAttribute("data-account-edit")) renameBusiness(button);
  if (button.hasAttribute("data-product-create")) {
    const account = states.accounts.items.find((item) => item.id === button.dataset.productCreate);
    if (account) openProductDialog({ ...account, name: "", barcode: "", category: "", price: "", stock: 0 }, true);
  }
});

document.getElementById("admin-product-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-product-edit]");
  if (button) openProductDialog(states.products.items[Number(button.dataset.productEdit)]);
});

document.getElementById("admin-transaction-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-transaction-detail]");
  if (button) showTransaction(Number(button.dataset.transactionDetail));
});

document.getElementById("admin-payment-list").addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.hasAttribute("data-payment-view")) showPaymentQr(Number(button.dataset.paymentView));
  if (button.hasAttribute("data-payment-toggle")) togglePayment(Number(button.dataset.paymentToggle), button);
});

document.getElementById("admin-alert-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-alert-status]");
  if (button) updateAlert(Number(button.dataset.alertStatus), button.dataset.status, button);
});

for (const closeButton of document.querySelectorAll("[data-dialog-close]")) {
  closeButton.addEventListener("click", () => closeButton.closest("dialog").close());
}

function bindSearch(resource, inputId) {
  const input = document.getElementById(inputId);
  input.addEventListener("input", () => {
    const state = states[resource];
    window.clearTimeout(state.timer);
    state.timer = window.setTimeout(() => {
      state.query = input.value.trim();
      if (resource === "accounts") loadAccounts(true);
      else loadResource(resource, true);
    }, 250);
  });
}

bindSearch("accounts", "admin-search");
for (const [resource, config] of Object.entries(resourceConfig)) bindSearch(resource, config.search);

document.getElementById("admin-refresh").addEventListener("click", () => loadAccounts(true));
document.getElementById("admin-load-more").addEventListener("click", () => loadAccounts());
for (const [resource, config] of Object.entries(resourceConfig)) {
  document.getElementById(config.refresh).addEventListener("click", () => loadResource(resource, true));
  document.getElementById(config.more).addEventListener("click", () => loadResource(resource));
}

document.querySelectorAll("[data-admin-tab]").forEach((tab) => {
  tab.addEventListener("click", () => {
    const selected = tab.dataset.adminTab;
    document.querySelectorAll("[data-admin-tab]").forEach((item) => {
      const active = item === tab;
      item.classList.toggle("active", active);
      item.setAttribute("aria-selected", String(active));
    });
    document.querySelectorAll("[data-admin-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.adminPanel !== selected;
    });
    if (selected === "accounts" && !states.accounts.loaded) loadAccounts(true);
    else if (resourceConfig[selected] && !states[selected].loaded) loadResource(selected, true);
  });
});

window.kasirSessionPromise.then(() => {
  const session = window.kasirSessionData;
  if (!session) return;
  if (!session.isAdmin) {
    showStatus("Akun ini belum diberi akses admin. Minta pengelola memeriksa konfigurasi ADMIN_USERNAME.", true);
    return;
  }
  dashboard.hidden = false;
  loadAccounts(true);
}).catch(() => {
  showStatus("Sesi belum dapat diperiksa. Muat ulang halaman atau masuk kembali.", true);
});
