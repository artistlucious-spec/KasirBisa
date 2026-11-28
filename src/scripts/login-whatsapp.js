const form = document.getElementById("form-login-whatsapp");
const phoneInput = document.getElementById("nomor-whatsapp");
const codeInput = document.getElementById("kode-whatsapp");
const sendButton = document.getElementById("kirim-kode-whatsapp");
const submitButton = document.getElementById("masuk-dengan-kode");
const codeSection = document.getElementById("bagian-kode-whatsapp");
const message = document.getElementById("pesan-login-whatsapp");

function showMessage(text, isError = true) {
  message.textContent = text;
  message.className = `login-message${isError ? " error" : ""}`;
}

function normalizedPhone() {
  return phoneInput.value.trim().replace(/\D/g, "");
}

function validatePhone() {
  const phone = normalizedPhone();
  phoneInput.setCustomValidity(/^\d{8,15}$/.test(phone) ? "" : "Masukkan nomor WhatsApp yang benar.");
  return phoneInput.reportValidity();
}

phoneInput.addEventListener("input", () => phoneInput.setCustomValidity(""));

sendButton.addEventListener("click", async () => {
  if (!validatePhone()) return;

  sendButton.disabled = true;
  showMessage("Mengirim kode...", false);
  try {
    const response = await fetch("/api/auth/whatsapp-login/request", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ whatsapp: phoneInput.value.trim() }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Kode belum dapat dikirim. Coba lagi nanti.");
    codeSection.hidden = false;
    sendButton.textContent = "Kirim ulang kode";
    codeInput.value = "";
    codeInput.focus();
    showMessage(data.message || "Jika nomor terdaftar, kode masuk akan dikirim melalui WhatsApp.", false);
  } catch (error) {
    showMessage(error.message);
  } finally {
    sendButton.disabled = false;
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!form.reportValidity() || !validatePhone()) return;

  submitButton.disabled = true;
  showMessage("Memeriksa kode...", false);
  try {
    const response = await fetch("/api/auth/whatsapp-login/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ whatsapp: phoneInput.value.trim(), code: codeInput.value.trim() }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Kode tidak benar atau sudah kedaluwarsa.");
    window.location.replace("dashboard.html");
  } catch (error) {
    showMessage(error.message);
    submitButton.disabled = false;
  }
});
