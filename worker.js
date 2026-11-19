const MAX_PRODUCT_IMAGE_LENGTH = 140 * 1024;

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function validProductImage(image) {
  return typeof image === "string"
    && image.length <= MAX_PRODUCT_IMAGE_LENGTH
    && (image === "" || /^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/.test(image));
}

function parseGeminiJson(text) {
  const cleaned = text.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function rupiah(value) {
  return `Rp${Number(value || 0).toLocaleString("id-ID")}`;
}

async function getProducts(env) {
  const result = await env.DB.prepare(
    "SELECT id, code, barcode, name, category, price, stock, image FROM products ORDER BY name"
  ).all();
  return (result.results || []).map((row) => ({
    kode: row.code,
    id: Number(row.id) || row.id,
    nama: row.name,
    barcode: row.barcode,
    kategori: row.category,
    harga: row.price,
    stock: row.stock,
    gambar: row.image,
  }));
}

async function getTransactions(env) {
  const result = await env.DB.prepare(
    "SELECT id, waktu, subtotal, diskon, ppn, total, dibayar, kembalian, member FROM transactions ORDER BY waktu DESC"
  ).all();
  const transactions = [];
  for (const row of result.results || []) {
    const items = await env.DB.prepare(
      "SELECT product_code AS kode, name AS nama, price AS harga, qty FROM transaction_items WHERE transaction_id = ?"
    ).bind(row.id).all();
    transactions.push({
      id: row.id,
      waktu: row.waktu,
      subtotal: row.subtotal,
      diskon: row.diskon,
      ppn: row.ppn,
      total: row.total,
      dibayar: row.dibayar,
      kembalian: row.kembalian,
      member: Boolean(row.member),
      items: (items.results || []).map((item) => ({
        kode: item.kode,
        nama: item.nama,
        harga: item.harga,
        qty: item.qty,
      })),
    });
  }
  return transactions;
}

async function productsApi(request, env, pathname) {
  if (request.method === "GET" && pathname === "/api/products") {
    return json(await getProducts(env));
  }

  if (request.method === "POST" && pathname === "/api/products") {
    const body = await request.json();
    const nama = String(body.nama || "").trim();
    const barcode = String(body.barcode || "").trim();
    const kategori = String(body.kategori || "").trim();
    const harga = Number(body.harga);
    const stock = Number(body.stock);
    const gambar = Object.hasOwn(body, "gambar") ? body.gambar : "";
    if (!nama || !barcode || !kategori || !Number.isSafeInteger(harga) || harga <= 0 || !Number.isSafeInteger(stock) || stock < 0) {
      return json({ error: "Data produk tidak valid" }, 400);
    }
    if (!validProductImage(gambar)) return json({ error: "Foto produk tidak valid atau terlalu besar" }, 400);
    const duplicate = await env.DB.prepare("SELECT code FROM products WHERE barcode = ?").bind(barcode).first();
    if (duplicate) return json({ error: "Barcode sudah digunakan produk lain" }, 409);
    const next = await env.DB.prepare(
      "SELECT COALESCE(MAX(CAST(id AS INTEGER)), 0) + 1 AS nomor FROM products"
    ).first();
    const id = String(next.nomor);
    const code = `K${String(next.nomor).padStart(2, "0")}`;
    await env.DB.prepare(
      "INSERT INTO products (id, code, barcode, name, category, price, stock, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(id, code, barcode, nama, kategori, harga, stock, gambar).run();
    return json({ success: true, kode: code }, 201);
  }

  const match = pathname.match(/^\/api\/products\/(.+)$/);
  if (!match) return json({ error: "Endpoint produk tidak ditemukan" }, 404);
  const code = decodeURIComponent(match[1]);

  if (request.method === "PUT") {
    const body = await request.json();
    const nama = String(body.nama || "").trim();
    const barcode = String(body.barcode || "").trim();
    const kategori = String(body.kategori || "").trim();
    const harga = Number(body.harga);
    const stock = Number(body.stock);
    const hasImage = Object.hasOwn(body, "gambar");
    const gambar = hasImage ? body.gambar : null;
    if (!nama || !barcode || !kategori || !Number.isSafeInteger(harga) || harga <= 0 || !Number.isSafeInteger(stock) || stock < 0) {
      return json({ error: "Data produk tidak valid" }, 400);
    }
    if (hasImage && !validProductImage(gambar)) return json({ error: "Foto produk tidak valid atau terlalu besar" }, 400);
    const duplicate = await env.DB.prepare(
      "SELECT code FROM products WHERE barcode = ? AND code != ?"
    ).bind(barcode, code).first();
    if (duplicate) return json({ error: "Barcode sudah digunakan produk lain" }, 409);
    const result = await env.DB.prepare(
      "UPDATE products SET barcode = ?, name = ?, category = ?, price = ?, stock = ?, image = COALESCE(?, image) WHERE code = ?"
    ).bind(barcode, nama, kategori, harga, stock, gambar, code).run();
    if (!result.meta.changes) return json({ error: "Produk tidak ditemukan" }, 404);
    return json({ success: true });
  }

  if (request.method === "DELETE") {
    const result = await env.DB.prepare("DELETE FROM products WHERE code = ?").bind(code).run();
    if (!result.meta.changes) return json({ error: "Produk tidak ditemukan" }, 404);
    return json({ success: true });
  }

  return json({ error: "Method tidak didukung" }, 405);
}

async function transactionsApi(request, env) {
  if (request.method === "GET") return json(await getTransactions(env));
  if (request.method !== "POST") return json({ error: "Method tidak didukung" }, 405);

  const body = await request.json();
  const items = Array.isArray(body.items) ? body.items : [];
  const dibayar = Number(body.dibayar);
  const member = Boolean(body.member);
  if (!items.length) return json({ error: "Keranjang masih kosong" }, 400);
  if (!Number.isSafeInteger(dibayar) || dibayar < 0) return json({ error: "Jumlah pembayaran tidak valid" }, 400);

  const verified = [];
  for (const item of items) {
    const code = String(item.kode || "");
    const qty = Number(item.qty);
    if (!code || !Number.isSafeInteger(qty) || qty < 1 || qty > 99) {
      return json({ error: "Rincian keranjang tidak valid" }, 400);
    }
    const product = await env.DB.prepare(
      "SELECT code, name, price, stock FROM products WHERE code = ?"
    ).bind(code).first();
    if (!product) return json({ error: `Produk ${code} tidak ditemukan` }, 404);
    if (product.stock < qty) return json({ error: `Stok ${product.name} tidak mencukupi` }, 409);
    verified.push({ ...product, qty });
  }

  const subtotal = verified.reduce((sum, item) => sum + item.price * item.qty, 0);
  const diskon = member
    ? Math.floor((subtotal * 10 + 50) / 100)
    : subtotal >= 100000
      ? Math.floor((subtotal * 5 + 50) / 100)
      : 0;
  const ppn = Math.floor(((subtotal - diskon) * 11 + 50) / 100);
  const total = subtotal - diskon + ppn;
  if (dibayar < total) return json({ error: "Uang pembayaran kurang" }, 400);
  const kembalian = dibayar - total;
  const waktu = new Date().toISOString();
  const transactionId = `TRX-${crypto.randomUUID()}`;
  const statements = [
    env.DB.prepare(
      "INSERT INTO transactions (id, waktu, subtotal, diskon, ppn, total, dibayar, kembalian, member) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(transactionId, waktu, subtotal, diskon, ppn, total, dibayar, kembalian, member ? 1 : 0),
  ];
  for (const item of verified) {
    statements.push(
      env.DB.prepare(
        "INSERT INTO transaction_items (id, transaction_id, product_code, name, price, qty) VALUES (?, ?, ?, ?, ?, ?)"
      ).bind(`ITEM-${crypto.randomUUID()}`, transactionId, item.code, item.name, item.price, item.qty),
      env.DB.prepare("UPDATE products SET stock = stock - ? WHERE code = ?").bind(item.qty, item.code)
    );
  }
  await env.DB.batch(statements);
  return json({
    success: true,
    transaksi: {
      id: transactionId,
      waktu,
      subtotal,
      diskon,
      ppn,
      total,
      dibayar,
      kembalian,
      member,
      items: verified.map((item) => ({ kode: item.code, nama: item.name, harga: item.price, qty: item.qty })),
    },
  }, 201);
}

async function smartInsightApi(env) {
  const transactions = await env.DB.prepare(
    "SELECT id, waktu, subtotal, diskon, ppn, total, dibayar, kembalian, member FROM transactions ORDER BY waktu DESC"
  ).all();
  const products = await env.DB.prepare(
    "SELECT code, name, category, price, stock FROM products ORDER BY name"
  ).all();
  const productMap = new Map((products.results || []).map((item) => [item.code, item]));
  const counts = new Map();
  const hours = new Map();
  let totalSales = 0;

  for (const transaction of transactions.results || []) {
    totalSales += Number(transaction.total || 0);
    const date = new Date(transaction.waktu);
    if (!Number.isNaN(date.getTime())) {
      const hour = date.getHours();
      hours.set(hour, (hours.get(hour) || 0) + 1);
    }
    const items = await env.DB.prepare(
      "SELECT product_code, qty FROM transaction_items WHERE transaction_id = ?"
    ).bind(transaction.id).all();
    for (const item of items.results || []) {
      counts.set(item.product_code, (counts.get(item.product_code) || 0) + Number(item.qty || 0));
    }
  }

  const topProducts = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([code, qty]) => ({ code, name: productMap.get(code)?.name || code, qty }));
  const lowStock = (products.results || [])
    .filter((item) => Number(item.stock) <= 10)
    .sort((a, b) => Number(a.stock) - Number(b.stock))
    .slice(0, 10)
    .map((item) => ({ name: item.name, stock: item.stock, category: item.category }));
  const busyHours = [...hours.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([hour, count]) => ({ hour, count }));
  const facts = {
    jumlah_transaksi: (transactions.results || []).length,
    total_penjualan: totalSales,
    produk_terlaris: topProducts,
    stok_menipis: lowStock,
    jam_ramai: busyHours,
  };
  const fallback = {
    ringkasan: facts.jumlah_transaksi
      ? `Terdapat ${facts.jumlah_transaksi} transaksi dengan total penjualan ${rupiah(totalSales)}.`
      : "Belum ada transaksi yang cukup untuk menghasilkan insight penjualan.",
    produk_terlaris: topProducts.length
      ? `${topProducts[0].name} menjadi produk paling banyak terjual sebanyak ${topProducts[0].qty} unit.`
      : "Belum ada produk terlaris karena belum ada transaksi.",
    stok_menipis: lowStock.length
      ? `${lowStock.map((item) => `${item.name} (${item.stock})`).join(", ")} perlu diprioritaskan untuk restok.`
      : "Belum ada produk pada batas stok rendah.",
    saran_penjualan: topProducts.length
      ? `Buat paket promo atau penempatan rak khusus untuk ${topProducts.slice(0, 3).map((item) => item.name).join(", ")}.`
      : "Mulai catat transaksi agar sistem dapat memberi saran penjualan.",
    jam_ramai: busyHours.length
      ? `Aktivitas tertinggi tercatat sekitar pukul ${busyHours.map((item) => `${String(item.hour).padStart(2, "0")}:00`).join(", ")}.`
      : "Belum ada waktu transaksi yang cukup untuk menentukan jam ramai.",
  };
  fallback.kartu = [
    { judul: "Produk Terlaris", isi: topProducts[0]?.name || "Belum tersedia data", tipe: "success" },
    { judul: "Stok Menipis", isi: lowStock.length ? `${lowStock.length} produk perlu restok` : "Stok masih aman", tipe: "warning" },
    { judul: "Saran Penjualan", isi: topProducts.length ? "Pertimbangkan paket promo" : "Mulai catat transaksi", tipe: "info" },
    { judul: "Jam Ramai", isi: busyHours.length ? `${String(busyHours[0].hour).padStart(2, "0")}:00` : "Belum tersedia", tipe: "info" },
  ];

  if (!env.GEMINI_API_KEY) {
    return json({
      success: false,
      needs_key: true,
      message: "API key Gemini belum dipasang.",
      setup: "Simpan API key sebagai secret Pages GEMINI_API_KEY pada project kasir-bisa.",
      facts,
      insight: fallback,
    });
  }

  const model = env.GEMINI_MODEL || "gemini-3.8-flash";
  const prompt = `Anda adalah asisten analisis usaha Kasir Bisa untuk UMKM Indonesia.
Jawab hanya berdasarkan data, gunakan bahasa Indonesia, dan kembalikan JSON valid dengan struktur:
{"ringkasan":"...","produk_terlaris":"...","stok_menipis":"...","saran_penjualan":"...","jam_ramai":"...","kartu":[{"judul":"...","isi":"...","tipe":"success|warning|info"}]}
Jangan mengarang angka. Jika data kurang, sebutkan bahwa data belum cukup.
DATA: ${JSON.stringify(facts)}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.25, maxOutputTokens: 800, responseMimeType: "application/json" },
      }),
    }
  );
  if (!response.ok) {
    const providerError = await response.json().catch(() => ({}));
    const providerMessage = String(
      providerError.error?.message || response.statusText || "Gemini menolak permintaan."
    ).replaceAll(env.GEMINI_API_KEY, "[API key disembunyikan]").slice(0, 400);
    return json({
      success: false,
      error: "Gemini API menolak permintaan",
      detail: `HTTP ${response.status}: ${providerMessage}`,
      facts,
      insight: fallback,
    }, 502);
  }
  const gemini = await response.json();
  const text = gemini.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
  return json({ success: true, facts, insight: parseGeminiJson(text) || fallback, source: "Gemini" });
}

export default {
  async fetch(request, env, context) {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/api/products" || url.pathname.startsWith("/api/products/")) {
        return await productsApi(request, env, url.pathname);
      }
      if (url.pathname === "/api/transactions") {
        return await transactionsApi(request, env);
      }
      if (url.pathname === "/api/smart-insight" && request.method === "POST") {
        return await smartInsightApi(env);
      }
      return await env.ASSETS.fetch(request);
    } catch (error) {
      return json({ error: "Permintaan gagal diproses", detail: error.message }, 500);
    }
  },
};
