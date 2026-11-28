// Mengatur menu burger dan menandai halaman yang sedang dibuka.
const menuButton = document.getElementById("menu-toggle");
const siteMenu = document.getElementById("site-menu");

function setMenuOpen(open) {
  siteMenu.hidden = !open;
  menuButton.setAttribute("aria-expanded", String(open));
  menuButton.setAttribute("aria-label", open ? "Tutup menu" : "Buka menu");
}

const currentPage = location.pathname.split("/").pop() || "index.html";
if (siteMenu && !siteMenu.querySelector('a[href="dashboard.html"]')) {
  const dashboardLink = document.createElement("a");
  dashboardLink.className = "header-link";
  dashboardLink.href = "dashboard.html";
  dashboardLink.textContent = "Dashboard";
  siteMenu.insertBefore(dashboardLink, siteMenu.firstElementChild);
}
siteMenu.querySelectorAll("a[href]").forEach((link) => {
  if (link.getAttribute("href") === currentPage || (currentPage === "rekap.html" && link.getAttribute("href") === "riwayat.html")) {
    link.classList.add("active");
    link.setAttribute("aria-current", "page");
  }
});

menuButton.addEventListener("click", () => setMenuOpen(siteMenu.hidden));
document.addEventListener("click", (event) => {
  if (!siteMenu.hidden && !siteMenu.contains(event.target) && !menuButton.contains(event.target)) setMenuOpen(false);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !siteMenu.hidden) { setMenuOpen(false); menuButton.focus(); }
});
siteMenu.addEventListener("click", (event) => { if (event.target.closest("a, button")) setMenuOpen(false); });

