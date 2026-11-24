// Mengelola profil, foto, dan pergantian password melalui API.
const profileForm = document.getElementById("form-profil");
const profileUsername = document.getElementById("profil-username");
const profileBusinessName = document.getElementById("profil-nama-usaha");
const profileImageInput = document.getElementById("foto-profil");
const profileImagePreview = document.getElementById("foto-profil-pratinjau");
const profileInitials = document.getElementById("inisial-profil");
const profileRemoveImage = document.getElementById("hapus-foto-profil");
const profileStatus = document.getElementById("status-profil");
const profileSaveButton = document.getElementById("simpan-profil");
const passwordToggle = document.getElementById("tombol-ganti-password");
const profileUsernameField = document.getElementById("kolom-username-profil");
const profilePasswordDisplay = document.getElementById("tampilan-password-profil");
const profilePasswordText = document.getElementById("teks-password-profil");
const profilePasswordVisibilityToggle = document.getElementById("lihat-password-profil");
const passwordFields = document.getElementById("kolom-form-password");
const currentPasswordInput = document.getElementById("password-saat-ini");
const currentPasswordVisibilityToggle = document.getElementById("lihat-password-saat-ini");
const passwordEyeIcon = currentPasswordVisibilityToggle.querySelector(".password-eye-icon");
const passwordEyeSlashIcon = currentPasswordVisibilityToggle.querySelector(".password-eye-slash-icon");
const profilePasswordEyeIcon = profilePasswordVisibilityToggle.querySelector(".password-eye-icon");
const profilePasswordEyeSlashIcon = profilePasswordVisibilityToggle.querySelector(".password-eye-slash-icon");
const newPasswordInput = document.getElementById("password-baru");
const confirmNewPasswordInput = document.getElementById("konfirmasi-password-baru");
let savedProfileImage = "";
let savedPassword = "";
let changedProfileImage = null;
let profileImageProcessing = false;
let profileLoaded = false;
let profileSupportsPasswordDisplay = false;
const qrisForm = document.getElementById("form-qris");
const qrisImageInput = document.getElementById("qris-gambar");
const qrisImagePreview = document.getElementById("qris-pratinjau");
const qrisEmptyPreview = document.getElementById("qris-pratinjau-kosong");
const qrisEnabledInput = document.getElementById("aktifkan-qris");
const qrisRemoveButton = document.getElementById("hapus-qris");
const qrisSaveButton = document.getElementById("simpan-qris");
const qrisStatus = document.getElementById("status-qris");
let savedQrisImage = "";
let changedQrisImage = null;
let qrisSettingsLoaded = false;
let qrisImageProcessing = false;

function setCurrentPasswordVisible(isVisible) {
  currentPasswordInput.type = isVisible ? "text" : "password";
  currentPasswordVisibilityToggle.setAttribute("aria-pressed", String(isVisible));
  currentPasswordVisibilityToggle.setAttribute(
    "aria-label",
    `${isVisible ? "Sembunyikan" : "Tampilkan"} password konfirmasi`
  );
  passwordEyeIcon.hidden = isVisible;
  passwordEyeSlashIcon.hidden = !isVisible;
}

function setSavedPasswordVisible(isVisible) {
  if (isVisible) {
    if (!profileSupportsPasswordDisplay) {
      setProfileStatus("Fitur lihat password belum aktif. Perbarui aplikasi terlebih dahulu.", true);
      return;
    }
    if (!savedPassword) {
      setProfileStatus("Keluar lalu masuk kembali sekali agar password dapat ditampilkan.", true);
      return;
    }
  }
  profilePasswordVisibilityToggle.setAttribute("aria-pressed", String(isVisible));
  profilePasswordVisibilityToggle.setAttribute(
    "aria-label",
    `${isVisible ? "Sembunyikan" : "Tampilkan"} password`
  );
  profilePasswordText.textContent = isVisible ? savedPassword : "••••••••";
  profilePasswordEyeIcon.hidden = isVisible;
  profilePasswordEyeSlashIcon.hidden = !isVisible;
}

function setPasswordMode(isEnabled) {
  // Perubahan username dan password dipisah agar verifikasi password saat ini tidak ambigu.
  passwordToggle.setAttribute("aria-expanded", String(isEnabled));
  passwordFields.hidden = !isEnabled;
  profileUsernameField.hidden = isEnabled;
  profilePasswordDisplay.hidden = isEnabled;
  currentPasswordInput.required = isEnabled;
  newPasswordInput.required = isEnabled;
  confirmNewPasswordInput.required = isEnabled;
  passwordToggle.textContent = isEnabled ? "Batal ganti password" : "Ganti password";
  setSavedPasswordVisible(false);
  if (!isEnabled) {
    currentPasswordInput.value = "";
    newPasswordInput.value = "";
    confirmNewPasswordInput.value = "";
    setCurrentPasswordVisible(false);
  }
}

currentPasswordVisibilityToggle.addEventListener("click", () => {
  setCurrentPasswordVisible(currentPasswordInput.type === "password");
});

profilePasswordVisibilityToggle.addEventListener("click", () => {
  setSavedPasswordVisible(profilePasswordVisibilityToggle.getAttribute("aria-pressed") !== "true");
});

passwordToggle.addEventListener("click", () => {
  const isExpanded = passwordToggle.getAttribute("aria-expanded") === "true";
  if (!isExpanded && profileUsername.value.trim() !== profileUsername.dataset.savedUsername) {
    setProfileStatus("Simpan perubahan nama pengguna sebelum mengganti password.", true);
    return;
  }
  setProfileStatus("");
  setPasswordMode(!isExpanded);
});

function setProfileStatus(text, isError = false) {
  profileStatus.textContent = text;
  profileStatus.className = `profile-status${isError ? " error" : ""}`;
}

function renderProfileImage(image, username) {
  profileImagePreview.hidden = !image;
  profileRemoveImage.hidden = !image;
  profileInitials.hidden = Boolean(image);
  profileInitials.textContent = String(username || "K").trim().charAt(0).toUpperCase() || "K";
  if (image) profileImagePreview.src = image;
  else profileImagePreview.removeAttribute("src");
}

function setQrisStatus(text, isError = false) {
  qrisStatus.textContent = text;
  qrisStatus.className = `profile-status${isError ? " error" : ""}`;
}

function renderQrisImage(image) {
  qrisImagePreview.hidden = !image;
  qrisEmptyPreview.hidden = Boolean(image);
  qrisRemoveButton.hidden = !image;
  if (image) qrisImagePreview.src = image;
  else qrisImagePreview.removeAttribute("src");
}

function readQrisFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Gambar QRIS tidak dapat dibaca."));
    }, { once: true });
    reader.addEventListener("error", () => reject(new Error("Gambar QRIS tidak dapat dibaca.")), { once: true });
    reader.readAsDataURL(file);
  });
}

async function loadQrisSettings() {
  try {
    const response = await fetch("/api/payment-settings", {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      window.location.replace("/login.html");
      return;
    }
    if (!response.ok) throw new Error(data.error || "Pengaturan QRIS tidak dapat dimuat.");

    savedQrisImage = data.qrisImage || "";
    qrisEnabledInput.checked = Boolean(data.qrisEnabled);
    renderQrisImage(savedQrisImage);
    qrisSettingsLoaded = true;
    qrisSaveButton.disabled = false;
  } catch (error) {
    setQrisStatus(error.message, true);
  }
}

qrisImageInput.addEventListener("change", async () => {
  const file = qrisImageInput.files?.[0];
  if (!file) return;
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    qrisImageInput.value = "";
    setQrisStatus("Pilih gambar QRIS berformat JPG, PNG, atau WebP.", true);
    return;
  }
  if (file.size > 100 * 1024) {
    qrisImageInput.value = "";
    setQrisStatus("Ukuran gambar QRIS maksimal 100 KB.", true);
    return;
  }

  qrisSaveButton.disabled = true;
  qrisRemoveButton.disabled = true;
  qrisImageProcessing = true;
  setQrisStatus("Membaca gambar QRIS...");
  try {
    changedQrisImage = await readQrisFile(file);
    renderQrisImage(changedQrisImage);
    setQrisStatus("Gambar QRIS siap disimpan.");
  } catch (error) {
    qrisImageInput.value = "";
    setQrisStatus(error.message, true);
  } finally {
    qrisImageProcessing = false;
    qrisRemoveButton.disabled = false;
    qrisSaveButton.disabled = !qrisSettingsLoaded;
  }
});

qrisRemoveButton.addEventListener("click", () => {
  changedQrisImage = "";
  qrisEnabledInput.checked = false;
  qrisImageInput.value = "";
  renderQrisImage("");
  setQrisStatus("Gambar akan dihapus saat pengaturan disimpan.");
});

qrisForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!qrisSettingsLoaded || qrisImageProcessing) {
    setQrisStatus("Tunggu sampai pengaturan dan gambar selesai dimuat.", true);
    return;
  }
  const qrisImage = changedQrisImage === null ? savedQrisImage : changedQrisImage;
  if (qrisEnabledInput.checked && !qrisImage) {
    setQrisStatus("Unggah gambar QRIS sebelum mengaktifkannya.", true);
    return;
  }

  qrisSaveButton.disabled = true;
  setQrisStatus("Menyimpan pengaturan QRIS...");
  try {
    const response = await fetch("/api/payment-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        qrisEnabled: qrisEnabledInput.checked,
        qrisImage,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      window.location.replace("/login.html");
      return;
    }
    if (!response.ok) throw new Error(data.error || "Pengaturan QRIS gagal disimpan.");

    savedQrisImage = data.qrisImage;
    changedQrisImage = null;
    renderQrisImage(savedQrisImage);
    qrisImageInput.value = "";
    setQrisStatus(
      data.qrisEnabled
        ? "QRIS aktif di halaman kasir."
        : "Pengaturan QRIS berhasil disimpan. QRIS saat ini nonaktif."
    );
  } catch (error) {
    setQrisStatus(error.message, true);
  } finally {
    qrisSaveButton.disabled = !qrisSettingsLoaded;
  }
});

async function loadProfile() {
  try {
    const response = await fetch("/api/auth/profile", {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      window.location.replace("/login.html");
      return;
    }
    if (!response.ok) throw new Error(data.error || "Profil tidak dapat dimuat.");

    profileUsername.value = data.username;
    profileBusinessName.value = data.businessName || "";
    document.getElementById("profil-whatsapp").textContent = data.whatsapp;
    savedProfileImage = data.profileImage || "";
    profileSupportsPasswordDisplay = Object.prototype.hasOwnProperty.call(data, "password");
    savedPassword = typeof data.password === "string" ? data.password : "";
    setSavedPasswordVisible(false);
    renderProfileImage(savedProfileImage, data.username);
    profileLoaded = true;
    profileSaveButton.disabled = false;
    passwordToggle.disabled = false;
  } catch (error) {
    setProfileStatus(error.message, true);
  }
}

profileImageInput.addEventListener("change", async (event) => {
  const file = event.currentTarget.files?.[0];
  if (!file) return;
  const previousImage = changedProfileImage;
  profileImageProcessing = true;
  profileSaveButton.disabled = true;
  profileRemoveImage.disabled = true;
  setProfileStatus("Memperkecil foto...");
  try {
    changedProfileImage = await KasirImageUtils.kompresKeWebp(file);
    renderProfileImage(changedProfileImage, profileUsername.value);
    setProfileStatus("Foto siap disimpan.");
  } catch (error) {
    changedProfileImage = previousImage;
    profileImageInput.value = "";
    renderProfileImage(changedProfileImage ?? savedProfileImage, profileUsername.value);
    setProfileStatus(error.message, true);
  } finally {
    profileImageProcessing = false;
    profileRemoveImage.disabled = false;
    profileSaveButton.disabled = !profileLoaded;
  }
});

profileRemoveImage.addEventListener("click", () => {
  if (profileImageProcessing) return;
  changedProfileImage = "";
  profileImageInput.value = "";
  renderProfileImage("", profileUsername.value);
  setProfileStatus("Foto akan dihapus saat perubahan disimpan.");
});

profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!profileForm.reportValidity()) return;
  if (profileImageProcessing) {
    setProfileStatus("Tunggu sampai foto selesai diproses.", true);
    return;
  }

  const currentPassword = currentPasswordInput.value;
  const newPassword = newPasswordInput.value;
  const confirmPassword = confirmNewPasswordInput.value;
  if (newPassword !== confirmPassword) {
    setProfileStatus("Ulangi password baru dengan benar.", true);
    return;
  }

  profileSaveButton.disabled = true;
  setProfileStatus("Menyimpan profil...");
  const credentialsChanged = profileUsername.value.trim() !== profileUsername.dataset.savedUsername || Boolean(newPassword);
  const businessNameChanged = profileBusinessName.value.trim() !== profileBusinessName.dataset.savedBusinessName;
  try {
    const body = {
      username: profileUsername.value.trim(),
      businessName: profileBusinessName.value.trim(),
      currentPassword,
      newPassword,
      ...(changedProfileImage === null ? {} : { profileImage: changedProfileImage }),
    };
    const response = await fetch("/api/auth/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      window.location.replace("/login.html");
      return;
    }
    if (!response.ok) throw new Error(data.error || "Perubahan profil gagal disimpan.");

    profileUsername.value = data.profile.username;
    profileUsername.dataset.savedUsername = data.profile.username;
    profileBusinessName.value = data.profile.businessName || profileBusinessName.value;
    profileBusinessName.dataset.savedBusinessName = profileBusinessName.value;
    savedProfileImage = data.profile.profileImage || "";
    window.kasirSessionData = { ...(window.kasirSessionData || {}), businessName: profileBusinessName.value, profileImage: savedProfileImage, username: data.profile.username };
    const headerName = document.querySelector(".header-store-name"); if (headerName) headerName.textContent = profileBusinessName.value;
    const headerAvatar = document.querySelector(".header-owner-avatar");
    if (headerAvatar) { headerAvatar.replaceChildren(); if (savedProfileImage) { const image = document.createElement("img"); image.src = savedProfileImage; image.alt = "Foto pemilik"; headerAvatar.append(image); } else { const initials = document.createElement("span"); initials.textContent = String(data.profile.username || "K").charAt(0).toUpperCase(); headerAvatar.append(initials); } }
    if (newPassword) savedPassword = newPassword;
    changedProfileImage = null;
    profileImageInput.value = "";
    setPasswordMode(false);
    renderProfileImage(savedProfileImage, data.profile.username);
    setProfileStatus(
      credentialsChanged
        ? "Profil disimpan. Kredensial diperbarui dan sesi login lain telah berakhir."
        : businessNameChanged
          ? "Nama toko berhasil diperbarui dan akan tampil di seluruh halaman."
          : "Profil berhasil disimpan."
    );
  } catch (error) {
    setProfileStatus(error.message, true);
  } finally {
    profileSaveButton.disabled = !profileLoaded;
  }
});

loadProfile().then(() => {
  profileUsername.dataset.savedUsername = profileUsername.value;
  profileBusinessName.dataset.savedBusinessName = profileBusinessName.value;
});
loadQrisSettings();
