document.documentElement.classList.add("auth-pending");
window.addEventListener("pageshow", (event) => {
  if (event.persisted) window.location.reload();
});

fetch("/api/auth/session", { headers: { Accept: "application/json" }, cache: "no-store" })
  .then(async (response) => {
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.authenticated) {
      window.location.replace("login.html");
      return;
    }

    document.documentElement.classList.remove("auth-pending");
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
