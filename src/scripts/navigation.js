const menuButton = document.getElementById("menu-toggle");
const siteMenu = document.getElementById("site-menu");

function setMenuOpen(open) {
  siteMenu.hidden = !open;
  menuButton.setAttribute("aria-expanded", String(open));
  menuButton.setAttribute("aria-label", open ? "Tutup menu" : "Buka menu");
}

menuButton.addEventListener("click", () => {
  setMenuOpen(siteMenu.hidden);
});

document.addEventListener("click", (event) => {
  if (!siteMenu.hidden && !siteMenu.contains(event.target) && !menuButton.contains(event.target)) {
    setMenuOpen(false);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !siteMenu.hidden) {
    setMenuOpen(false);
    menuButton.focus();
  }
});

siteMenu.addEventListener("click", (event) => {
  if (event.target.closest("a, button")) setMenuOpen(false);
});
