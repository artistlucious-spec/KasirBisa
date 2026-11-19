const MAX_PRODUCT_IMAGE_LENGTH = 140 * 1024;
const AUTH_COOKIE_NAME = "kasir_bisa_session";
const AUTH_SESSION_SECONDS = 12 * 60 * 60;
const PASSWORD_HASH_ITERATIONS = 100_000;
const AUTH_SETUP_MESSAGE = "Autentikasi belum siap. Administrator perlu mengatur AUTH_SESSION_SECRET dan menerapkan migrasi D1 terbaru.";
const textEncoder = new TextEncoder();
const USER_SELECT = `SELECT
  users.id, users.business_id, users.username, users.whatsapp,
  users.password_hash, users.password_salt, users.password_iterations,
  users.profile_image, users.session_version, businesses.name AS business_name
  FROM users JOIN businesses ON businesses.id = users.business_id`;

function json(data, status = 200, extraHeaders = {}) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store", ...extraHeaders },
  });
}

function sessionSecretConfigured(env) {
  return typeof env.AUTH_SESSION_SECRET === "string"
    && env.AUTH_SESSION_SECRET.length >= 32;
}

function bootstrapCredentialsConfigured(env) {
  return typeof env.KASIR_USERNAME === "string"
    && env.KASIR_USERNAME.length > 0
    && env.KASIR_USERNAME.length <= 128
    && typeof env.KASIR_PASSWORD === "string"
    && env.KASIR_PASSWORD.length >= 12
    && env.KASIR_PASSWORD.length <= 256
    && sessionSecretConfigured(env);
}

async function derivePasswordHash(password, salt, iterations) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const hash = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return new Uint8Array(hash);
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePasswordHash(password, salt, PASSWORD_HASH_ITERATIONS);
  return {
    hash: bytesToBase64Url(hash),
    salt: bytesToBase64Url(salt),
    iterations: PASSWORD_HASH_ITERATIONS,
  };
}

async function verifyPassword(password, profile) {
  let salt;
  let expectedHash;
  try {
    salt = base64UrlToBytes(profile.password_salt);
    expectedHash = base64UrlToBytes(profile.password_hash);
  } catch {
    return false;
  }
  const iterations = Number(profile.password_iterations);
  if (salt.length !== 16 || expectedHash.length !== 32 || iterations !== PASSWORD_HASH_ITERATIONS) {
    return false;
  }
  const actualHash = await derivePasswordHash(password, salt, iterations);
  let difference = 0;
  for (let index = 0; index < actualHash.length; index += 1) {
    difference |= actualHash[index] ^ expectedHash[index];
  }
  return difference === 0;
}

async function getUserById(env, id) {
  return env.DB.prepare(`${USER_SELECT} WHERE users.id = ?`).bind(id).first();
}

async function getOrCreateLegacyUser(env) {
  let user = await getUserById(env, "legacy-owner");
  if (user || !bootstrapCredentialsConfigured(env)) return user;

  const credentials = await hashPassword(env.KASIR_PASSWORD);
  await env.DB.prepare(
    "INSERT OR IGNORE INTO users (id, business_id, username, password_hash, password_salt, password_iterations) VALUES ('legacy-owner', 'legacy-business', ?, ?, ?, ?)"
  ).bind(env.KASIR_USERNAME.trim(), credentials.hash, credentials.salt, credentials.iterations).run();
  user = await getUserById(env, "legacy-owner");
  return user;
}

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function base64UrlToBytes(value) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function createSessionToken(secret, userId, sessionVersion) {
  const expiry = String(Math.floor(Date.now() / 1000) + AUTH_SESSION_SECONDS);
  const version = String(sessionVersion);
  const payload = `${userId}.${expiry}.${version}`;
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(payload));
  return `${payload}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

async function getSessionUser(request, env) {
  if (!sessionSecretConfigured(env)) return null;
  const cookie = (request.headers.get("Cookie") || "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${AUTH_COOKIE_NAME}=`));
  if (!cookie) return null;

  const token = cookie.slice(AUTH_COOKIE_NAME.length + 1);
  const [userId, expiry, version, encodedSignature, ...extraParts] = token.split(".");
  if (
    extraParts.length
    || !/^[\w-]{1,128}$/.test(userId)
    || !/^\d{10,}$/.test(expiry)
    || !/^\d+$/.test(version)
    || Number(expiry) <= Math.floor(Date.now() / 1000)
  ) {
    return null;
  }

  let signature;
  try {
    signature = base64UrlToBytes(encodedSignature);
  } catch {
    return null;
  }
  if (signature.length !== 32) return null;
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(env.AUTH_SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    signature,
    textEncoder.encode(`${userId}.${expiry}.${version}`)
  );
  if (!valid) return null;

  const user = await getUserById(env, userId);
  return user && version === String(user.session_version) ? user : null;
}

function cookieHeaders(request, token, maxAge) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return {
    "Set-Cookie": `${AUTH_COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure}`,
  };
}

async function parseJsonBody(request) {
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}

async function authApi(request, env, pathname) {
  const origin = request.headers.get("Origin");
  if (request.method !== "GET" && origin && origin !== new URL(request.url).origin) {
    return json({ error: "Permintaan lintas situs ditolak." }, 403);
  }

  if (pathname === "/api/auth/logout" && request.method === "POST") {
    return json({ success: true }, 200, {
      "Set-Cookie": `${AUTH_COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`,
    });
  }

  if (pathname === "/api/auth/signup" && request.method === "POST") {
    if (!sessionSecretConfigured(env)) {
      return json({ error: AUTH_SETUP_MESSAGE }, 503);
    }
    await getOrCreateLegacyUser(env);
    const body = await parseJsonBody(request);
    if (!body) return json({ error: "Format pendaftaran tidak valid." }, 400);

    const businessName = typeof body.businessName === "string" ? body.businessName.trim() : "";
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const rawWhatsapp = typeof body.whatsapp === "string" ? body.whatsapp.trim() : "";
    const whatsapp = rawWhatsapp.replace(/\D/g, "");
    const password = typeof body.password === "string" ? body.password : "";
    if (
      !businessName || businessName.length > 120
      || !username || username.length > 128
      || !/^[+()\d\s.-]+$/.test(rawWhatsapp)
      || !/^[\d]{8,15}$/.test(whatsapp)
      || password.length < 12 || password.length > 256
    ) {
      return json({ error: "Periksa kembali nama usaha, nama pengguna, WhatsApp, dan password (12–256 karakter)." }, 400);
    }

    const existing = await env.DB.prepare(
      "SELECT id FROM users WHERE username = ? COLLATE NOCASE OR whatsapp = ?"
    ).bind(username, whatsapp).first();
    if (existing) return json({ error: "Nama pengguna atau nomor WhatsApp sudah terdaftar." }, 409);

    const userId = crypto.randomUUID();
    const businessId = crypto.randomUUID();
    const credentials = await hashPassword(password);
    await env.DB.batch([
      env.DB.prepare("INSERT INTO businesses (id, name) VALUES (?, ?)").bind(businessId, businessName),
      env.DB.prepare(
        "INSERT INTO users (id, business_id, username, whatsapp, password_hash, password_salt, password_iterations) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).bind(
        userId,
        businessId,
        username,
        whatsapp,
        credentials.hash,
        credentials.salt,
        credentials.iterations
      ),
    ]);

    const token = await createSessionToken(env.AUTH_SESSION_SECRET, userId, 1);
    return json(
      { success: true },
      201,
      cookieHeaders(request, token, AUTH_SESSION_SECONDS)
    );
  }

  if (pathname === "/api/auth/login" && request.method === "POST") {
    if (!sessionSecretConfigured(env)) {
      return json({ error: AUTH_SETUP_MESSAGE }, 503);
    }
    await getOrCreateLegacyUser(env);
    const body = await parseJsonBody(request);
    if (!body) {
      return json({ error: "Format permintaan login tidak valid." }, 400);
    }
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (username.length > 128 || password.length > 256 || !username || !password) {
      return json({ error: "Nama pengguna atau password salah." }, 401);
    }

    const lookup = username.replace(/\D/g, "");
    const user = await env.DB.prepare(
      `${USER_SELECT} WHERE username = ? COLLATE NOCASE OR (whatsapp <> '' AND whatsapp = ?)`
    ).bind(username, lookup).first();
    const passwordMatches = user
      ? await verifyPassword(password, user)
      : await derivePasswordHash(password, new Uint8Array(16), PASSWORD_HASH_ITERATIONS);
    if (!user || !passwordMatches) {
      return json({ error: "Nama pengguna atau password salah." }, 401);
    }

    const token = await createSessionToken(env.AUTH_SESSION_SECRET, user.id, user.session_version);
    return json({ success: true }, 200, cookieHeaders(request, token, AUTH_SESSION_SECONDS));
  }

  if (pathname === "/api/auth/session" && request.method === "GET") {
    if (!sessionSecretConfigured(env)) {
      return json({ authenticated: false, error: AUTH_SETUP_MESSAGE }, 503);
    }
    await getOrCreateLegacyUser(env);
    const user = await getSessionUser(request, env);
    return json({
      authenticated: Boolean(user),
      ...(user ? { username: user.username, businessName: user.business_name } : {}),
    });
  }

  if (pathname === "/api/auth/profile" && ["GET", "PUT"].includes(request.method)) {
    if (!sessionSecretConfigured(env)) {
      return json({ error: AUTH_SETUP_MESSAGE }, 503);
    }
    const user = await getSessionUser(request, env);
    if (!user) {
      return json({ error: "Sesi login tidak valid. Silakan masuk kembali." }, 401);
    }
    if (request.method === "GET") {
      return json({
        username: user.username,
        whatsapp: user.whatsapp,
        businessName: user.business_name,
        profileImage: user.profile_image,
      });
    }

    const body = await parseJsonBody(request);
    if (!body) return json({ error: "Data profil tidak valid." }, 400);
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
    const hasImage = Object.hasOwn(body, "profileImage");
    const profileImage = hasImage ? body.profileImage : null;
    if (!username || username.length > 128 || !currentPassword || currentPassword.length > 256) {
      return json({ error: "Nama pengguna atau password saat ini tidak valid." }, 400);
    }
    if (newPassword && (newPassword.length < 12 || newPassword.length > 256)) {
      return json({ error: "Password baru harus berisi 12 sampai 256 karakter." }, 400);
    }
    if (hasImage && !validProductImage(profileImage)) {
      return json({ error: "Foto profil tidak valid atau terlalu besar." }, 400);
    }
    if (!await verifyPassword(currentPassword, user)) {
      return json({ error: "Password saat ini salah." }, 401);
    }
    if (!hasImage && !newPassword && username === user.username) {
      return json({ error: "Tidak ada perubahan untuk disimpan." }, 400);
    }
    const duplicate = await env.DB.prepare(
      "SELECT id FROM users WHERE username = ? COLLATE NOCASE AND id != ?"
    ).bind(username, user.id).first();
    if (duplicate) return json({ error: "Nama pengguna sudah digunakan akun lain." }, 409);

    const nextPassword = newPassword ? await hashPassword(newPassword) : {
      hash: user.password_hash,
      salt: user.password_salt,
      iterations: user.password_iterations,
    };
    const credentialsChanged = username !== user.username || Boolean(newPassword);
    const sessionVersion = Number(user.session_version) + (credentialsChanged ? 1 : 0);
    const result = await env.DB.prepare(
      "UPDATE users SET username = ?, password_hash = ?, password_salt = ?, password_iterations = ?, profile_image = COALESCE(?, profile_image), session_version = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(
      username,
      nextPassword.hash,
      nextPassword.salt,
      nextPassword.iterations,
      profileImage,
      sessionVersion,
      user.id
    ).run();
    if (!result.meta.changes) return json({ error: "Profil tidak ditemukan." }, 404);

    const headers = credentialsChanged
      ? cookieHeaders(request, await createSessionToken(env.AUTH_SESSION_SECRET, user.id, sessionVersion), AUTH_SESSION_SECONDS)
      : {};
    return json({
      success: true,
      profile: {
        username,
        profileImage: hasImage ? profileImage : user.profile_image,
      },
    }, 200, headers);
  }

  return json({ error: "Endpoint autentikasi tidak ditemukan." }, 404);
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

function geminiErrorMessage(status) {
  const messages = {
    400: "Permintaan analisis ditolak oleh layanan AI.",
    401: "Layanan AI belum dapat diakses. Pengelola perlu memeriksa API key.",
    403: "Akses ke layanan AI ditolak. Pengelola perlu memeriksa izin API key.",
    404: "Model AI tidak ditemukan. Pengelola perlu memeriksa konfigurasi model.",
    429: "Batas penggunaan layanan AI tercapai. Coba lagi nanti.",
    503: "Layanan AI sedang sibuk atau mengalami gangguan sementara. Coba lagi beberapa saat.",
  };
  return messages[status] || `Layanan AI mengalami kendala (HTTP ${status}). Coba lagi nanti.`;
}

function rupiah(value) {
  return `Rp${Number(value || 0).toLocaleString("id-ID")}`;
}

async function getProducts(env, businessId) {
  const result = await env.DB.prepare(
    "SELECT id, code, barcode, name, category, price, stock, image FROM products WHERE business_id = ? ORDER BY name"
  ).bind(businessId).all();
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

async function getTransactions(env, businessId) {
  const result = await env.DB.prepare(
    "SELECT id, waktu, subtotal, diskon, ppn, total, dibayar, kembalian, member FROM transactions WHERE business_id = ? ORDER BY waktu DESC"
  ).bind(businessId).all();
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

async function productsApi(request, env, pathname, businessId) {
  if (request.method === "GET" && pathname === "/api/products") {
    return json(await getProducts(env, businessId));
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
    const duplicate = await env.DB.prepare(
      "SELECT code FROM products WHERE business_id = ? AND barcode = ?"
    ).bind(businessId, barcode).first();
    if (duplicate) return json({ error: "Barcode sudah digunakan produk lain" }, 409);
    const next = await env.DB.prepare(
      "SELECT COALESCE(MAX(CAST(id AS INTEGER)), 0) + 1 AS nomor FROM products WHERE business_id = ?"
    ).bind(businessId).first();
    const id = String(next.nomor);
    const code = `K${String(next.nomor).padStart(2, "0")}`;
    await env.DB.prepare(
      "INSERT INTO products (id, business_id, code, barcode, name, category, price, stock, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(id, businessId, code, barcode, nama, kategori, harga, stock, gambar).run();
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
      "SELECT code FROM products WHERE business_id = ? AND barcode = ? AND code != ?"
    ).bind(businessId, barcode, code).first();
    if (duplicate) return json({ error: "Barcode sudah digunakan produk lain" }, 409);
    const result = await env.DB.prepare(
      "UPDATE products SET barcode = ?, name = ?, category = ?, price = ?, stock = ?, image = COALESCE(?, image) WHERE business_id = ? AND code = ?"
    ).bind(barcode, nama, kategori, harga, stock, gambar, businessId, code).run();
    if (!result.meta.changes) return json({ error: "Produk tidak ditemukan" }, 404);
    return json({ success: true });
  }

  if (request.method === "DELETE") {
    const result = await env.DB.prepare(
      "DELETE FROM products WHERE business_id = ? AND code = ?"
    ).bind(businessId, code).run();
    if (!result.meta.changes) return json({ error: "Produk tidak ditemukan" }, 404);
    return json({ success: true });
  }

  return json({ error: "Method tidak didukung" }, 405);
}

async function transactionsApi(request, env, businessId) {
  if (request.method === "GET") return json(await getTransactions(env, businessId));
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
      "SELECT code, name, price, stock FROM products WHERE business_id = ? AND code = ?"
    ).bind(businessId, code).first();
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
      "INSERT INTO transactions (id, business_id, waktu, subtotal, diskon, ppn, total, dibayar, kembalian, member) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(transactionId, businessId, waktu, subtotal, diskon, ppn, total, dibayar, kembalian, member ? 1 : 0),
  ];
  for (const item of verified) {
    statements.push(
      env.DB.prepare(
        "INSERT INTO transaction_items (id, transaction_id, product_code, name, price, qty) VALUES (?, ?, ?, ?, ?, ?)"
      ).bind(`ITEM-${crypto.randomUUID()}`, transactionId, item.code, item.name, item.price, item.qty),
      env.DB.prepare(
        "UPDATE products SET stock = stock - ? WHERE business_id = ? AND code = ?"
      ).bind(item.qty, businessId, item.code)
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

async function smartInsightApi(env, businessId) {
  const transactions = await env.DB.prepare(
    "SELECT id, waktu, subtotal, diskon, ppn, total, dibayar, kembalian, member FROM transactions WHERE business_id = ? ORDER BY waktu DESC"
  ).bind(businessId).all();
  const products = await env.DB.prepare(
    "SELECT code, name, category, price, stock FROM products WHERE business_id = ? ORDER BY name"
  ).bind(businessId).all();
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
    return json({
      success: false,
      error: "Gemini API menolak permintaan",
      detail: `${geminiErrorMessage(response.status)} Insight cadangan tetap ditampilkan.`,
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
      if (url.pathname.startsWith("/api/auth/")) {
        return await authApi(request, env, url.pathname);
      }
      if (url.pathname.startsWith("/api/")) {
        if (!sessionSecretConfigured(env)) {
          return json({ error: AUTH_SETUP_MESSAGE }, 503);
        }
        await getOrCreateLegacyUser(env);
        const user = await getSessionUser(request, env);
        if (!user) {
          return json({ error: "Sesi login tidak valid. Silakan masuk kembali." }, 401);
        }
        if (url.pathname === "/api/products" || url.pathname.startsWith("/api/products/")) {
          return await productsApi(request, env, url.pathname, user.business_id);
        }
        if (url.pathname === "/api/transactions") {
          return await transactionsApi(request, env, user.business_id);
        }
        if (url.pathname === "/api/smart-insight" && request.method === "POST") {
          return await smartInsightApi(env, user.business_id);
        }
        return json({ error: "Endpoint API tidak ditemukan" }, 404);
      }
      return await env.ASSETS.fetch(request);
    } catch (error) {
      return json({ error: "Permintaan gagal diproses", detail: error.message }, 500);
    }
  },
};
