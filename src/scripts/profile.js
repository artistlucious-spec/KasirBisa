const profileForm = document.getElementById("form-profil");
const profileUsername = document.getElementById("profil-username");
const profileImageInput = document.getElementById("foto-profil");
const profileImagePreview = document.getElementById("foto-profil-pratinjau");
const profileInitials = document.getElementById("inisial-profil");
const profileRemoveImage = document.getElementById("hapus-foto-profil");
const profileStatus = document.getElementById("status-profil");
const profileSaveButton = document.getElementById("simpan-profil");
let savedProfileImage = "";
let changedProfileImage = null;
let profileImageProcessing = false;
let profileLoaded = false;

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
    savedProfileImage = data.profileImage || "";
    renderProfileImage(savedProfileImage, data.username);
    profileLoaded = true;
    profileSaveButton.disabled = false;
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

  const currentPassword = document.getElementById("password-saat-ini").value;
  const newPassword = document.getElementById("password-baru").value;
  const confirmPassword = document.getElementById("konfirmasi-password-baru").value;
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
    changedProfileImage = null;
    profileImageInput.value = "";
    document.getElementById("password-saat-ini").value = "";
    document.getElementById("password-baru").value = "";
    document.getElementById("konfirmasi-password-baru").value = "";
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
