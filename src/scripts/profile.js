// Mengelola profil, foto, dan pergantian password melalui API.
const profileForm = document.getElementById("form-profil");
const profileUsername = document.getElementById("profil-username");
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
    document.getElementById("profil-usaha").textContent = data.businessName;
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
  try {
    const body = {
      username: profileUsername.value.trim(),
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
    savedProfileImage = data.profile.profileImage || "";
    if (newPassword) savedPassword = newPassword;
    changedProfileImage = null;
    profileImageInput.value = "";
    setPasswordMode(false);
    renderProfileImage(savedProfileImage, data.profile.username);
    setProfileStatus(
      credentialsChanged
        ? "Profil disimpan. Kredensial diperbarui dan sesi login lain telah berakhir."
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
});
