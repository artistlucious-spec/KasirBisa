const statusMessage = document.getElementById("admin-status");
const dashboard = document.getElementById("admin-dashboard");
const accountList = document.getElementById("admin-account-list");
const searchInput = document.getElementById("admin-search");
const loadMoreButton = document.getElementById("admin-load-more");
const refreshButton = document.getElementById("admin-refresh");
const pageSize = 50;

let accounts = [];
let offset = 0;
let total = 0;
let searchQuery = "";
let loading = false;
let searchTimer;

function showStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.className = `notice${isError ? " error" : ""}`;
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(`${String(value).replace(" ", "T")}Z`);
  return Number.isNaN(date.getTime())
    ? String(value)
    : new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(date);
}

function updateSummary(summary = {}) {
  document.getElementById("jumlah-akun").textContent = String(summary.total || 0);
  document.getElementById("jumlah-aktif").textContent = String(summary.active || 0);
  document.getElementById("jumlah-nonaktif").textContent = String(summary.disabled || 0);
}

function renderAccounts() {
  accountList.replaceChildren();
  if (accounts.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.className = "admin-empty";
    cell.colSpan = 6;
    cell.textContent = "Tidak ada akun yang cocok.";
    row.append(cell);
    accountList.append(row);
    return;
  }

  for (const account of accounts) {
    const row = document.createElement("tr");
    const business = document.createElement("td");
    business.textContent = account.businessName || "-";
    const username = document.createElement("td");
    username.textContent = account.username || "-";
    const created = document.createElement("td");
    created.textContent = formatDate(account.createdAt);
    const usage = document.createElement("td");
    usage.textContent = `${account.productCount} produk / ${account.transactionCount} transaksi`;
    const status = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = `admin-status-badge${account.active ? " active" : " inactive"}`;
    badge.textContent = account.active ? "Aktif" : "Nonaktif";
    status.append(badge);
    const actions = document.createElement("td");
    const button = document.createElement("button");
    button.className = account.active ? "secondary-button admin-account-action" : "primary-button admin-account-action";
    button.type = "button";
    button.dataset.accountId = account.id;
    button.dataset.nextActive = String(!account.active);
    button.disabled = account.isAdmin;
    button.textContent = account.isAdmin
      ? "Admin utama"
      : account.active ? "Nonaktifkan" : "Aktifkan";
    actions.append(button);
    row.append(business, username, created, usage, status, actions);
    accountList.append(row);
  }
}

async function loadAccounts(reset = false) {
  if (loading) return;
  if (reset) {
    offset = 0;
    accounts = [];
  }
  loading = true;
  refreshButton.disabled = true;
  loadMoreButton.disabled = true;
  if (accounts.length === 0) showStatus("Memuat daftar akun...");

  const params = new URLSearchParams({ offset: String(offset) });
  if (searchQuery) params.set("q", searchQuery);
  try {
    const response = await fetch(`/api/admin/accounts?${params}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Daftar akun tidak dapat dimuat.");
    accounts = reset ? data.accounts : [...accounts, ...data.accounts];
    total = data.total;
    offset += data.accounts.length;
    updateSummary(data.summary);
    renderAccounts();
    document.getElementById("admin-result-count").textContent =
      `Menampilkan ${accounts.length} dari ${total} akun yang cocok.`;
    loadMoreButton.hidden = accounts.length >= total;
    showStatus("Data akun berhasil dimuat.");
  } catch (error) {
    showStatus(error.message || "Tidak dapat menghubungi server. Periksa koneksi internet.", true);
    if (accounts.length === 0) renderAccounts();
  } finally {
    loading = false;
    refreshButton.disabled = false;
    loadMoreButton.disabled = false;
  }
}

accountList.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-account-id]");
  if (!button || button.disabled) return;

  const nextActive = button.dataset.nextActive === "true";
  const action = nextActive ? "mengaktifkan" : "menonaktifkan";
  if (!window.confirm(`Yakin ingin ${action} akun ini?`)) return;

  button.disabled = true;
  showStatus(`${nextActive ? "Mengaktifkan" : "Menonaktifkan"} akun...`);
  try {
    const response = await fetch("/api/admin/accounts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ userId: button.dataset.accountId, active: nextActive }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Status akun tidak berhasil diubah.");
    await loadAccounts(true);
    showStatus(nextActive ? "Akun berhasil diaktifkan." : "Akun berhasil dinonaktifkan.");
  } catch (error) {
    button.disabled = false;
    showStatus(error.message || "Tidak dapat menghubungi server. Periksa koneksi internet.", true);
  }
});

searchInput.addEventListener("input", () => {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => {
    searchQuery = searchInput.value.trim();
    loadAccounts(true);
  }, 250);
});

refreshButton.addEventListener("click", () => loadAccounts(true));
loadMoreButton.addEventListener("click", () => loadAccounts());

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
