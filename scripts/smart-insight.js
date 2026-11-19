const button = document.getElementById("buat-insight");
const notice = document.getElementById("insight-notice");
const keyArea = document.getElementById("api-key-area");

function rupiah(value) {
  return "Rp" + Number(value || 0).toLocaleString("id-ID");
}

function setNotice(text, type = "") {
  notice.textContent = text;
  notice.className = "notice" + (type ? ` ${type}` : "");
}

async function generateInsight() {
  button.disabled = true;
  button.textContent = "Menganalisis data...";
  keyArea.hidden = true;
  setNotice("Mengumpulkan transaksi, produk, dan stok dari database...");
  document.getElementById("insight-ringkasan").innerHTML =
    '<span class="insight-loader">Gemini sedang menyiapkan insight...</span>';

  try {
    const response = await fetch("/api/smart-insight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      window.location.replace("/login.html");
      return;
    }
    if (!response.ok && !data.insight) {
      throw new Error(data.detail || data.error || "Smart Insight tidak dapat diproses");
    }

    const insight = data.insight || {};
    document.getElementById("insight-ringkasan").innerHTML =
      `<p>${escapeHtml(insight.ringkasan || "Belum ada ringkasan.")}</p>`;
    document.getElementById("insight-produk").textContent =
      insight.produk_terlaris || "Belum tersedia";
    document.getElementById("insight-stok").textContent =
      insight.stok_menipis || "Belum tersedia";
    document.getElementById("insight-jam").textContent =
      insight.jam_ramai || "Belum tersedia";
    document.getElementById("insight-saran").textContent =
      insight.saran_penjualan || "Belum tersedia";

    const cards = Array.isArray(insight.kartu) ? insight.kartu : [];
    const cardGrid = document.getElementById("insight-kartu");
    cardGrid.replaceChildren();
    for (const card of cards) {
      const article = document.createElement("article");
      article.className = `insight-mini-card ${card.tipe || "info"}`;
      const title = document.createElement("span");
      title.textContent = card.judul;
      const value = document.createElement("strong");
      value.textContent = card.isi;
      article.append(title, value);
      cardGrid.appendChild(article);
    }

    const facts = data.facts || {};
    document.getElementById("fact-transaksi").textContent =
      String(facts.jumlah_transaksi || 0);
    document.getElementById("fact-total").textContent =
      rupiah(facts.total_penjualan);
    document.getElementById("fact-produk").textContent =
      facts.produk_terlaris?.[0]?.name || "-";
    document.getElementById("fact-stok").textContent =
      String((facts.stok_menipis || []).length);

    if (data.needs_key) {
      keyArea.hidden = false;
      setNotice(data.setup, "error");
    } else if (data.success) {
      setNotice("Insight berhasil dibuat dari data penjualan dan stok.", "success");
    } else {
      setNotice(
        data.detail || data.error || "Insight cadangan ditampilkan karena Gemini tidak dapat dipanggil.",
        "error"
      );
    }
  } catch (error) {
    keyArea.hidden = true;
    setNotice(error.message, "error");
    document.getElementById("insight-ringkasan").textContent =
      "Smart Insight belum dapat dimuat.";
  } finally {
    button.disabled = false;
    button.innerHTML = '<span aria-hidden="true">✦</span> Buat insight baru';
  }
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = String(text);
  return div.innerHTML;
}

button.addEventListener("click", generateInsight);
generateInsight();
