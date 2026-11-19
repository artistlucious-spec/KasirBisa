const form = document.getElementById("form-signup");
const submitButton = document.getElementById("tombol-daftar");
const message = document.getElementById("pesan-daftar");

function showMessage(text, isError = true) {
  message.textContent = text;
  message.className = `login-message${isError ? " error" : ""}`;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;

  const password = document.getElementById("kata-sandi").value;
  const confirmPassword = document.getElementById("konfirmasi-kata-sandi").value;
  if (password !== confirmPassword) {
    showMessage("Konfirmasi password belum sama.");
    return;
  }

  submitButton.disabled = true;
  showMessage("Membuat akun...", false);
  try {
    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        businessName: document.getElementById("nama-usaha").value.trim(),
        username: document.getElementById("nama-pengguna").value.trim(),
        whatsapp: document.getElementById("nomor-whatsapp").value.trim(),
        password,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Pendaftaran gagal.");
    window.location.replace("index.html");
  } catch (error) {
    showMessage(error.message);
    submitButton.disabled = false;
  }
});
