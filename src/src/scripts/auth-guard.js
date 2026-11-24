// Menahan halaman privat sampai server memastikan cookie sesi masih sah.
document.documentElement.classList.add("auth-pending");
window.addEventListener("pageshow", (event) => {
  if (event.persisted) window.location.reload();
});

window.kasirSessionPromise = fetch("/api/auth/session", { headers: { Accept: "application/json" }, cache: "no-store" })
  .then(async (response) => {
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.authenticated) {
      window.location.replace("login.html");
      return;
    }

    window.kasirSessionData = data;
    document.documentElement.classList.remove("auth-pending");
    const renderStoreIdentity = () => {
      const header = document.querySelector(".site-header");
      if (!header || header.querySelector(".header-store-identity")) return;
      const link = document.createElement("a");
      link.className = "header-store-identity";
      link.href = "profile.html";
      link.setAttribute("aria-label", "Buka profil toko");
      const text = document.createElement("span"); text.className = "header-store-name"; text.textContent = data.businessName || "Usaha Anda";
      const avatar = document.createElement("span"); avatar.className = "header-owner-avatar";
      if (data.profileImage) { const image = document.createElement("img"); image.src = data.profileImage; image.alt = "Foto pemilik"; avatar.append(image); }
      else { const initials = document.createElement("span"); initials.textContent = String(data.username || "K").trim().charAt(0).toUpperCase(); avatar.append(initials); }
      link.append(text, avatar); header.append(link);
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", renderStoreIdentity, { once: true });
    else renderStoreIdentity();
    const bindLogout = () => {
      const logoutButton = document.getElementById("tombol-keluar");
      logoutButton?.addEventListener("click", async () => {
        logoutButton.disabled = true;
        try {
          const logout = await fetch("/api/auth/logout", { method: "POST" });
          if (!logout.ok) throw new Error("Server menolak permintaan keluar.");
          window.location.replace("login.html");
        } catch {
          logoutButton.disabled = false;
          window.alert("Tidak dapat keluar. Periksa koneksi lalu coba lagi.");
        }
      });
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", bindLogout, { once: true });
    } else {
      bindLogout();
    }
  })
  .catch(() => window.location.replace("login.html"));
