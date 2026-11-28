// Mengirim kredensial ke API login dan menampilkan statusnya pada halaman.
const form = document.getElementById("form-login");
const usernameInput = document.getElementById("nama-pengguna");
const passwordInput = document.getElementById("kata-sandi");
const submitButton = document.getElementById("tombol-login");
const message = document.getElementById("pesan-login");

function showMessage(text, isError = true) {
  message.textContent = text;
  message.className = `login-message${isError ? " error" : ""}`;
}

function openedDirectlyFromFile() {
  return window.location.protocol === "file:";
}

function showServerRequiredMessage() {
  showMessage(
    "Aplikasi sedang dibuka langsung dari file. Jalankan server Kasir Bisa terlebih dahulu dengan perintah npm run dev, lalu buka alamat lokal yang ditampilkan Wrangler."
  );
}

async function checkExistingSession() {
  if (openedDirectlyFromFile()) {
    showServerRequiredMessage();
    submitButton.disabled = true;
    return;
  }

  try {
    const response = await fetch("/api/auth/session", {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data.authenticated) {
      window.location.replace("dashboard.html");
      return;
    }
    if (!response.ok) showMessage(data.error || "Login belum dapat digunakan. Hubungi administrator.");
  } catch {
    showMessage("Tidak dapat menghubungi server. Periksa koneksi internet.");
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (openedDirectlyFromFile()) {
    showServerRequiredMessage();
    return;
  }
  if (!form.reportValidity()) return;

  submitButton.disabled = true;
  showMessage("Memeriksa akun...", false);
  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        username: usernameInput.value.trim(),
        password: passwordInput.value,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Login gagal.");
    window.location.replace("dashboard.html");
  } catch (error) {
    showMessage(error.message);
    submitButton.disabled = false;
  }
});

document.getElementById("lihat-kata-sandi").addEventListener("click", (event) => {
  const button = event.currentTarget;
  const showing = passwordInput.type === "text";
  passwordInput.type = showing ? "password" : "text";
  button.textContent = showing ? "Lihat" : "Sembunyikan";
  button.setAttribute("aria-label", showing ? "Tampilkan password" : "Sembunyikan password");
});

checkExistingSession();
