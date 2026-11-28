// Backend bersama untuk semua route Pages: autentikasi, produk, transaksi, dan insight.
const MAX_PRODUCT_IMAGE_LENGTH = 140 * 1024;
const MAX_QRIS_IMAGE_LENGTH = 140 * 1024;
const MAX_QRIS_COUNT_PER_BUSINESS = 10;
const AUTH_COOKIE_NAME = "kasir_bisa_session";
const AUTH_SESSION_SECONDS = 12 * 60 * 60;
const PASSWORD_HASH_ITERATIONS = 100_000;
const WHATSAPP_LOGIN_CODE_SECONDS = 10 * 60;
const WHATSAPP_LOGIN_MAX_ATTEMPTS = 5;
const WHATSAPP_LOGIN_RATE_WINDOW_MS = 15 * 60 * 1000;
const AUTH_SETUP_MESSAGE = "Autentikasi belum siap. Administrator perlu mengatur AUTH_SESSION_SECRET dan menerapkan migrasi D1 terbaru.";
const textEncoder = new TextEncoder();
const USER_SELECT = `SELECT
  users.id, users.business_id, users.username, users.whatsapp,
  users.password_hash, users.password_salt, users.password_iterations,
  users.password_encrypted, users.profile_image, users.session_version, users.is_active,
  businesses.name AS business_name
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

function isAdminUser(user, env) {
  const configuredUsername = typeof env.ADMIN_USERNAME === "string" ? env.ADMIN_USERNAME.trim() : "";
  return Boolean(
    user
    && configuredUsername
    && configuredUsername.length <= 128
    && user.username.toLowerCase() === configuredUsername.toLowerCase()
  );
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

async function passwordEncryptionKey(secret, usages) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    "HKDF",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: textEncoder.encode("KasirBisa/password-view/v1"),
      info: textEncoder.encode("AES-GCM password encryption"),
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    usages
  );
}

async function encryptPassword(password, secret) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await passwordEncryptionKey(secret, ["encrypt"]);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    textEncoder.encode(password)
  );
  return `v1.${bytesToBase64Url(iv)}.${bytesToBase64Url(new Uint8Array(ciphertext))}`;
}

async function decryptPassword(encryptedPassword, secret) {
  const [version, encodedIv, encodedCiphertext, ...extra] = String(encryptedPassword || "").split(".");
  if (version !== "v1" || !encodedIv || !encodedCiphertext || extra.length) {
    throw new Error("Format password terenkripsi tidak valid.");
  }
  const iv = base64UrlToBytes(encodedIv);
  if (iv.length !== 12) throw new Error("Format password terenkripsi tidak valid.");
  const key = await passwordEncryptionKey(secret, ["decrypt"]);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    base64UrlToBytes(encodedCiphertext)
  );
  return new TextDecoder().decode(plaintext);
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
  // Bandingkan seluruh byte agar hasil tidak bergantung pada posisi byte yang berbeda.
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
  const encryptedPassword = await encryptPassword(env.KASIR_PASSWORD, env.AUTH_SESSION_SECRET);
  await env.DB.prepare(
    "INSERT OR IGNORE INTO users (id, business_id, username, password_hash, password_salt, password_iterations, password_encrypted) VALUES ('legacy-owner', 'legacy-business', ?, ?, ?, ?, ?)"
  ).bind(
    env.KASIR_USERNAME.trim(),
    credentials.hash,
    credentials.salt,
    credentials.iterations,
    encryptedPassword
  ).run();
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
  // Cookie hanya memuat identitas, masa berlaku, dan versi sesi yang ditandatangani HMAC.
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
  // Setiap request privat memverifikasi tanda tangan dan versi sesi yang masih berlaku.
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
  return user
    && Number(user.is_active) === 1
    && version === String(user.session_version)
    ? user
    : null;
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

function whatsappLoginConfigured(env) {
  return typeof env.WHATSAPP_ACCESS_TOKEN === "string"
    && env.WHATSAPP_ACCESS_TOKEN.length > 0
    && typeof env.WHATSAPP_PHONE_NUMBER_ID === "string"
    && /^\d+$/.test(env.WHATSAPP_PHONE_NUMBER_ID)
    && typeof env.WHATSAPP_API_VERSION === "string"
    && /^v\d+\.\d+$/.test(env.WHATSAPP_API_VERSION)
    && typeof env.WHATSAPP_LOGIN_TEMPLATE_NAME === "string"
    && /^[a-z0-9_]+$/.test(env.WHATSAPP_LOGIN_TEMPLATE_NAME)
    && typeof env.WHATSAPP_LOGIN_TEMPLATE_LANGUAGE === "string"
    && /^[a-zA-Z]{2,3}(?:_[a-zA-Z]{2,4})?$/.test(env.WHATSAPP_LOGIN_TEMPLATE_LANGUAGE);
}

async function hmacBytes(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, textEncoder.encode(value)));
}

async function createWhatsAppLoginCodeHash(secret, challengeId, whatsapp, code) {
  return bytesToBase64Url(await hmacBytes(secret, `whatsapp-login:${challengeId}:${whatsapp}:${code}`));
}

async function sendWhatsAppLoginCode(env, whatsapp, code) {
  const recipient = whatsapp.startsWith("0") ? `62${whatsapp.slice(1)}` : whatsapp;
  try {
    const response = await fetch(
      `https://graph.facebook.com/${env.WHATSAPP_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: recipient,
          type: "template",
          template: {
            name: env.WHATSAPP_LOGIN_TEMPLATE_NAME,
            language: { code: env.WHATSAPP_LOGIN_TEMPLATE_LANGUAGE },
            components: [
              {
                type: "body",
                parameters: [{ type: "text", text: code }],
              },
              {
                type: "button",
                sub_type: "url",
                index: "0",
                parameters: [{ type: "text", text: code }],
              },
            ],
          },
        }),
      }
    );
    if (!response.ok) {
      const result = await response.json().catch(() => null);
      const providerError = result?.error;
      console.error("[WHATSAPP LOGIN CODE DELIVERY FAILED]", {
        status: response.status,
        code: providerError?.code,
        subcode: providerError?.error_subcode,
        type: providerError?.type,
        message: providerError?.message,
      });
      return false;
    }
    return true;
  } catch (error) {
    console.error("[WHATSAPP LOGIN CODE DELIVERY FAILED]", { message: error?.message || String(error) });
    return false;
  }
}

async function authApi(request, env, pathname) {
  // Satu handler menangani seluruh URL /api/auth/* setelah pemeriksaan origin.
  const origin = request.headers.get("Origin");
  if (request.method !== "GET" && origin && origin !== new URL(request.url).origin) {
    return json({ error: "Permintaan lintas situs ditolak." }, 403);
  }

  if (pathname === "/api/auth/logout" && request.method === "POST") {
    return json({ success: true }, 200, {
      "Set-Cookie": `${AUTH_COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`,
    });
  }

  if (pathname === "/api/auth/whatsapp-login/request" && request.method === "POST") {
    if (!sessionSecretConfigured(env)) return json({ error: AUTH_SETUP_MESSAGE }, 503);
    if (!whatsappLoginConfigured(env)) {
      return json({ error: "Masuk dengan kode WhatsApp belum aktif. Gunakan kata sandi atau hubungi pengelola." }, 503);
    }
    const body = await parseJsonBody(request);
    if (!body) return json({ error: "Nomor WhatsApp tidak valid." }, 400);
    const rawWhatsapp = typeof body.whatsapp === "string" ? body.whatsapp.trim() : "";
    const whatsapp = rawWhatsapp.replace(/\D/g, "");
    if (!/^\d{8,15}$/.test(whatsapp)) {
      return json({ error: "Masukkan nomor WhatsApp yang digunakan saat mendaftar." }, 400);
    }

    const now = Date.now();
    const phoneHash = bytesToBase64Url(await hmacBytes(env.AUTH_SESSION_SECRET, `phone:${whatsapp}`));
    const clientIp = request.headers.get("CF-Connecting-IP") || "unknown";
    const ipHash = bytesToBase64Url(await hmacBytes(env.AUTH_SESSION_SECRET, `ip:${clientIp}`));
    await env.DB.batch([
      env.DB.prepare("DELETE FROM whatsapp_login_requests WHERE created_at < ?").bind(now - 24 * 60 * 60 * 1000),
      env.DB.prepare("DELETE FROM whatsapp_login_codes WHERE expires_at <= ? OR consumed_at IS NOT NULL").bind(now),
    ]);

    const [phoneRequests, ipRequests] = await Promise.all([
      env.DB.prepare("SELECT COUNT(*) AS count FROM whatsapp_login_requests WHERE phone_hash = ? AND created_at >= ?")
        .bind(phoneHash, now - WHATSAPP_LOGIN_RATE_WINDOW_MS).first(),
      env.DB.prepare("SELECT COUNT(*) AS count FROM whatsapp_login_requests WHERE ip_hash = ? AND created_at >= ?")
        .bind(ipHash, now - WHATSAPP_LOGIN_RATE_WINDOW_MS).first(),
    ]);
    if (Number(phoneRequests?.count || 0) >= 3 || Number(ipRequests?.count || 0) >= 10) {
      return json({ error: "Permintaan kode terlalu sering. Tunggu beberapa saat, lalu coba lagi." }, 429);
    }
    await env.DB.prepare(
      "INSERT INTO whatsapp_login_requests (id, phone_hash, ip_hash, created_at) VALUES (?, ?, ?, ?)"
    ).bind(crypto.randomUUID(), phoneHash, ipHash, now).run();

    const user = await env.DB.prepare(`${USER_SELECT} WHERE users.whatsapp = ?`).bind(whatsapp).first();
    if (!user || Number(user.is_active) !== 1) {
      return json({ success: true, message: "Jika nomor terdaftar, kode masuk akan dikirim melalui WhatsApp." });
    }

    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
    const challengeId = crypto.randomUUID();
    const codeHash = await createWhatsAppLoginCodeHash(env.AUTH_SESSION_SECRET, challengeId, whatsapp, code);
    const expiresAt = now + WHATSAPP_LOGIN_CODE_SECONDS * 1000;
    await env.DB.prepare(`
      INSERT INTO whatsapp_login_codes (whatsapp, challenge_id, user_id, code_hash, created_at, expires_at, attempts, consumed_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, NULL)
      ON CONFLICT(whatsapp) DO UPDATE SET
        challenge_id = excluded.challenge_id,
        user_id = excluded.user_id,
        code_hash = excluded.code_hash,
        created_at = excluded.created_at,
        expires_at = excluded.expires_at,
        attempts = 0,
        consumed_at = NULL
    `).bind(whatsapp, challengeId, user.id, codeHash, now, expiresAt).run();

    if (!await sendWhatsAppLoginCode(env, whatsapp, code)) {
      await env.DB.prepare("UPDATE whatsapp_login_codes SET consumed_at = ? WHERE whatsapp = ? AND challenge_id = ?")
        .bind(now, whatsapp, challengeId).run();
      return json({ error: "Kode belum dapat dikirim. Coba lagi nanti atau masuk dengan kata sandi." }, 503);
    }
    return json({ success: true, message: "Jika nomor terdaftar, kode masuk akan dikirim melalui WhatsApp." });
  }

  if (pathname === "/api/auth/whatsapp-login/verify" && request.method === "POST") {
    if (!sessionSecretConfigured(env)) return json({ error: AUTH_SETUP_MESSAGE }, 503);
    const body = await parseJsonBody(request);
    if (!body) return json({ error: "Nomor WhatsApp atau kode tidak valid." }, 400);
    const rawWhatsapp = typeof body.whatsapp === "string" ? body.whatsapp.trim() : "";
    const whatsapp = rawWhatsapp.replace(/\D/g, "");
    const code = typeof body.code === "string" ? body.code.trim() : "";
    if (!/^\d{8,15}$/.test(whatsapp) || !/^\d{6}$/.test(code)) {
      return json({ error: "Masukkan nomor WhatsApp dan kode 6 angka yang benar." }, 400);
    }

    const now = Date.now();
    const challenge = await env.DB.prepare(`
      SELECT challenge_id, user_id, code_hash, expires_at, attempts
      FROM whatsapp_login_codes
      WHERE whatsapp = ? AND consumed_at IS NULL AND expires_at > ?
    `).bind(whatsapp, now).first();
    if (!challenge || Number(challenge.attempts) >= WHATSAPP_LOGIN_MAX_ATTEMPTS) {
      return json({ error: "Kode tidak benar atau sudah kedaluwarsa. Minta kode baru." }, 401);
    }

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
      base64UrlToBytes(challenge.code_hash),
      textEncoder.encode(`whatsapp-login:${challenge.challenge_id}:${whatsapp}:${code}`)
    );
    if (!valid) {
      await env.DB.prepare(`
        UPDATE whatsapp_login_codes
        SET attempts = attempts + 1,
          consumed_at = CASE WHEN attempts + 1 >= ? THEN ? ELSE consumed_at END
        WHERE whatsapp = ? AND challenge_id = ? AND consumed_at IS NULL AND expires_at > ? AND attempts < ?
      `).bind(WHATSAPP_LOGIN_MAX_ATTEMPTS, now, whatsapp, challenge.challenge_id, now, WHATSAPP_LOGIN_MAX_ATTEMPTS).run();
      return json({ error: "Kode tidak benar atau sudah kedaluwarsa. Periksa kembali atau minta kode baru." }, 401);
    }

    const consumed = await env.DB.prepare(`
      UPDATE whatsapp_login_codes SET consumed_at = ?
      WHERE whatsapp = ? AND challenge_id = ? AND consumed_at IS NULL AND expires_at > ? AND attempts < ?
    `).bind(now, whatsapp, challenge.challenge_id, now, WHATSAPP_LOGIN_MAX_ATTEMPTS).run();
    if (!consumed.meta.changes) {
      return json({ error: "Kode tidak benar atau sudah kedaluwarsa. Minta kode baru." }, 401);
    }

    const user = await getUserById(env, challenge.user_id);
    if (!user || Number(user.is_active) !== 1) {
      return json({ error: "Akun ini tidak aktif. Hubungi pengelola usaha." }, 403);
    }
    const token = await createSessionToken(env.AUTH_SESSION_SECRET, user.id, user.session_version);
    return json({ success: true }, 200, cookieHeaders(request, token, AUTH_SESSION_SECONDS));
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
      || password.length < 4 || password.length > 12
    ) {
      return json({ error: "Periksa kembali nama usaha, nama pengguna, WhatsApp, dan kata sandi (4–12 karakter)." }, 400);
    }

    // Pemeriksaan awal memberi pesan ramah; indeks unik database tetap menjadi penjaga terakhir.
    const existing = await env.DB.prepare(
      "SELECT id FROM users WHERE username = ? COLLATE NOCASE OR whatsapp = ?"
    ).bind(username, whatsapp).first();
    if (existing) return json({ error: "Nama pengguna atau nomor WhatsApp sudah terdaftar." }, 409);

    const userId = crypto.randomUUID();
    const businessId = crypto.randomUUID();
    const credentials = await hashPassword(password);
    const encryptedPassword = await encryptPassword(password, env.AUTH_SESSION_SECRET);
    await env.DB.batch([
      env.DB.prepare("INSERT INTO businesses (id, name) VALUES (?, ?)").bind(businessId, businessName),
      env.DB.prepare(
        "INSERT INTO users (id, business_id, username, whatsapp, password_hash, password_salt, password_iterations, password_encrypted) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(
        userId,
        businessId,
        username,
        whatsapp,
        credentials.hash,
        credentials.salt,
        credentials.iterations,
        encryptedPassword
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
      return json({ error: "Nama pengguna/usaha atau kata sandi salah." }, 401);
    }

    let user = await env.DB.prepare(
      `${USER_SELECT} WHERE users.username = ? COLLATE NOCASE`
    ).bind(username).first();
    if (!user) {
      const businessMatches = await env.DB.prepare(`
        SELECT COUNT(*) AS count
        FROM users
        JOIN businesses ON businesses.id = users.business_id
        WHERE businesses.name = ? COLLATE NOCASE
      `).bind(username).first();
      if (Number(businessMatches?.count || 0) > 1) {
        await derivePasswordHash(password, new Uint8Array(16), PASSWORD_HASH_ITERATIONS);
        return json({
          error: "Nama usaha atau kata sandi salah. Jika nama usaha digunakan usaha lain, masuklah dengan nama pengguna.",
        }, 401);
      }
      if (Number(businessMatches?.count || 0) === 1) {
        user = await env.DB.prepare(
          `${USER_SELECT} WHERE businesses.name = ? COLLATE NOCASE`
        ).bind(username).first();
      }
    }
    const passwordMatches = user
      ? await verifyPassword(password, user)
      : await derivePasswordHash(password, new Uint8Array(16), PASSWORD_HASH_ITERATIONS);
    if (!user || Number(user.is_active) !== 1 || !passwordMatches) {
      return json({ error: "Nama pengguna/usaha atau kata sandi salah." }, 401);
    }

    const encryptedPassword = await encryptPassword(password, env.AUTH_SESSION_SECRET);
    await env.DB.prepare(
      "UPDATE users SET password_encrypted = ? WHERE id = ?"
    ).bind(encryptedPassword, user.id).run();

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
      ...(user ? {
        username: user.username,
        businessName: user.business_name,
        profileImage: user.profile_image || "",
        isAdmin: isAdminUser(user, env),
      } : {}),
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
      let password = null;
      if (user.password_encrypted) {
        try {
          password = await decryptPassword(user.password_encrypted, env.AUTH_SESSION_SECRET);
        } catch (error) {
          console.error("Password profil tidak dapat didekripsi.", error);
          return json({ error: "Password profil tidak dapat ditampilkan. Silakan masuk kembali." }, 500);
        }
      }
      return json({
        username: user.username,
        whatsapp: user.whatsapp,
        businessName: user.business_name,
        profileImage: user.profile_image,
        password,
      });
    }

    if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
      return json({ error: "Method tidak didukung" }, 405);
    }
    const body = await parseJsonBody(request);
    if (!body) return json({ error: "Data profil tidak valid." }, 400);
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const hasBusinessName = Object.hasOwn(body, "businessName");
    const businessName = hasBusinessName && typeof body.businessName === "string" ? body.businessName.trim() : "";
    const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
    const hasImage = Object.hasOwn(body, "profileImage");
    const profileImage = hasImage ? body.profileImage : null;
    if (!username || username.length > 128 || currentPassword.length > 256) {
      return json({ error: "Nama pengguna atau password tidak valid." }, 400);
    }
    if (username.toLowerCase() !== user.username.toLowerCase() && isAdminUser(user, env)) {
      return json({ error: "Nama pengguna akun admin tidak dapat diubah dari halaman profil." }, 400);
    }
    if (hasBusinessName && (!businessName || businessName.length > 120)) {
      return json({ error: "Nama toko wajib diisi dan maksimal 120 karakter." }, 400);
    }
    if (newPassword && (newPassword.length < 4 || newPassword.length > 12)) {
      return json({ error: "Kata sandi baru harus berisi 4 sampai 12 karakter." }, 400);
    }
    if (newPassword && !currentPassword) {
      return json({ error: "Password saat ini wajib diisi untuk mengganti password." }, 400);
    }
    if (hasImage && !validProductImage(profileImage)) {
      return json({ error: "Foto profil tidak valid atau terlalu besar." }, 400);
    }
    if (newPassword && !await verifyPassword(currentPassword, user)) {
      return json({ error: "Password saat ini salah." }, 401);
    }
    const businessNameChanged = hasBusinessName && businessName !== user.business_name;
    if (!hasImage && !newPassword && username === user.username && !businessNameChanged) {
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
    const encryptedPassword = newPassword
      ? await encryptPassword(newPassword, env.AUTH_SESSION_SECRET)
      : user.password_encrypted;
    const credentialsChanged = username !== user.username || Boolean(newPassword);
    const sessionVersion = Number(user.session_version) + (credentialsChanged ? 1 : 0);
    const result = await env.DB.prepare(
      "UPDATE users SET username = ?, password_hash = ?, password_salt = ?, password_iterations = ?, password_encrypted = ?, profile_image = COALESCE(?, profile_image), session_version = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(
      username,
      nextPassword.hash,
      nextPassword.salt,
      nextPassword.iterations,
      encryptedPassword,
      profileImage,
      sessionVersion,
      user.id
    ).run();
    if (!result.meta.changes) return json({ error: "Profil tidak ditemukan." }, 404);
    if (businessNameChanged) {
      const businessResult = await env.DB.prepare(
        "UPDATE businesses SET name = ? WHERE id = ?"
      ).bind(businessName, user.business_id).run();
      if (!businessResult.meta.changes) return json({ error: "Data toko tidak ditemukan." }, 404);
    }

    const headers = credentialsChanged
      ? cookieHeaders(request, await createSessionToken(env.AUTH_SESSION_SECRET, user.id, sessionVersion), AUTH_SESSION_SECONDS)
      : {};
    return json({
      success: true,
      profile: {
        username,
        businessName: hasBusinessName ? businessName : user.business_name,
        profileImage: hasImage ? profileImage : user.profile_image,
      },
    }, 200, headers);
  }

  return json({ error: "Endpoint autentikasi tidak ditemukan." }, 404);
}

async function adminAccountsApi(request, env, adminUser) {
  if (request.method === "GET") {
    const url = new URL(request.url);
    const search = (url.searchParams.get("q") || "").trim().slice(0, 100);
    const offsetValue = Number(url.searchParams.get("offset") || 0);
    if (!Number.isSafeInteger(offsetValue) || offsetValue < 0 || offsetValue > 1_000_000) {
      return json({ error: "Halaman akun tidak valid." }, 400);
    }

    const where = search
      ? "WHERE instr(lower(users.username), lower(?)) > 0 OR instr(lower(businesses.name), lower(?)) > 0"
      : "";
    const searchBindings = search ? [search, search] : [];
    const [count, summary, result] = await Promise.all([
      env.DB.prepare(
        `SELECT COUNT(*) AS total
         FROM users JOIN businesses ON businesses.id = users.business_id
         ${where}`
      ).bind(...searchBindings).first(),
      env.DB.prepare(
        `SELECT COUNT(*) AS total,
          COALESCE(SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END), 0) AS active,
          COALESCE(SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END), 0) AS disabled
         FROM users`
      ).first(),
      env.DB.prepare(
        `SELECT users.id, users.business_id, users.username, users.whatsapp, users.created_at, users.is_active,
          businesses.name AS business_name,
          (SELECT COUNT(*) FROM products WHERE products.business_id = users.business_id) AS product_count,
          (SELECT COUNT(*) FROM transactions WHERE transactions.business_id = users.business_id) AS transaction_count
         FROM users JOIN businesses ON businesses.id = users.business_id
         ${where}
         ORDER BY users.created_at DESC, users.id
         LIMIT 50 OFFSET ?`
      ).bind(...searchBindings, offsetValue).all(),
    ]);

    return json({
      accounts: (result.results || []).map((account) => ({
        id: account.id,
        businessId: account.business_id,
        username: account.username,
        whatsapp: account.whatsapp || "",
        businessName: account.business_name,
        createdAt: account.created_at,
        active: Number(account.is_active) === 1,
        isAdmin: isAdminUser(account, env),
        productCount: Number(account.product_count) || 0,
        transactionCount: Number(account.transaction_count) || 0,
      })),
      total: Number(count?.total) || 0,
      offset: offsetValue,
      limit: 50,
      summary: {
        total: Number(summary?.total) || 0,
        active: Number(summary?.active) || 0,
        disabled: Number(summary?.disabled) || 0,
      },
    });
  }

  if (request.method === "PATCH") {
    const body = await parseJsonBody(request);
    const userId = typeof body?.userId === "string" ? body.userId : "";
    if (!/^[\w-]{1,128}$/.test(userId)) {
      return json({ error: "Akun yang dipilih tidak valid." }, 400);
    }

    const target = await env.DB.prepare(
      "SELECT id, business_id, username, is_active FROM users WHERE id = ?"
    ).bind(userId).first();
    if (!target) return json({ error: "Akun tidak ditemukan." }, 404);
    if (target.id === adminUser.id || isAdminUser(target, env)) {
      return json({ error: "Akun admin utama tidak dapat diubah dari halaman ini." }, 400);
    }

    if (typeof body.active === "boolean") {
      if ((Number(target.is_active) === 1) === body.active) {
        return json({ success: true, active: body.active, unchanged: true });
      }
      const result = await env.DB.prepare(
        "UPDATE users SET is_active = ?, session_version = session_version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
      ).bind(body.active ? 1 : 0, target.id).run();
      if (!result.meta.changes) return json({ error: "Status akun tidak berhasil diperbarui." }, 500);
      return json({ success: true, active: body.active });
    }

    const businessName = typeof body.businessName === "string" ? body.businessName.trim() : "";
    if (!businessName || businessName.length > 120) {
      return json({ error: "Nama usaha wajib diisi dan maksimal 120 karakter." }, 400);
    }
    const result = await env.DB.prepare(
      "UPDATE businesses SET name = ? WHERE id = ?"
    ).bind(businessName, target.business_id).run();
    if (!result.meta.changes) return json({ error: "Nama usaha tidak berhasil diperbarui." }, 500);
    return json({ success: true, businessName });
  }

  return json({ error: "Metode tidak didukung." }, 405, { Allow: "GET, PATCH" });
}

async function adminDataApi(request, env) {
  const url = new URL(request.url);
  const resource = url.searchParams.get("resource") || "";
  const search = (url.searchParams.get("q") || "").trim().slice(0, 100);
  const offset = Number(url.searchParams.get("offset") || 0);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1_000_000) {
    return json({ error: "Halaman data tidak valid." }, 400);
  }

  if (resource === "products" && request.method === "GET") {
    const where = search
      ? "WHERE instr(lower(products.name), lower(?)) > 0 OR instr(lower(products.code), lower(?)) > 0 OR instr(lower(products.barcode), lower(?)) > 0 OR instr(lower(businesses.name), lower(?)) > 0 OR instr(lower(users.username), lower(?)) > 0"
      : "";
    const bindings = search ? [search, search, search, search, search] : [];
    const [count, summary, result] = await Promise.all([
      env.DB.prepare(
        `SELECT COUNT(*) AS total
         FROM products
         JOIN businesses ON businesses.id = products.business_id
         JOIN users ON users.business_id = businesses.id
         ${where}`
      ).bind(...bindings).first(),
      env.DB.prepare(
        `SELECT COUNT(*) AS total,
          COALESCE(SUM(CASE WHEN stock <= 5 THEN 1 ELSE 0 END), 0) AS lowStock
         FROM products`
      ).first(),
      env.DB.prepare(
        `SELECT products.business_id, businesses.name AS business_name, users.username,
          products.code, products.barcode, products.name, products.category, products.price, products.stock
         FROM products
         JOIN businesses ON businesses.id = products.business_id
         JOIN users ON users.business_id = businesses.id
         ${where}
         ORDER BY businesses.name, products.name
         LIMIT 50 OFFSET ?`
      ).bind(...bindings, offset).all(),
    ]);
    return json({
      items: (result.results || []).map((row) => ({
        businessId: row.business_id,
        businessName: row.business_name,
        username: row.username,
        code: row.code,
        barcode: row.barcode,
        name: row.name,
        category: row.category,
        price: Number(row.price),
        stock: Number(row.stock),
      })),
      total: Number(count?.total) || 0,
      offset,
      limit: 50,
      summary: { total: Number(summary?.total) || 0, lowStock: Number(summary?.lowStock) || 0 },
    });
  }

  if (resource === "products" && ["POST", "PATCH"].includes(request.method)) {
    const body = await parseJsonBody(request);
    const businessId = typeof body?.businessId === "string" ? body.businessId : "";
    const code = typeof body?.code === "string" ? body.code.trim() : "";
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const barcode = typeof body?.barcode === "string" ? body.barcode.trim() : "";
    const category = typeof body?.category === "string" ? body.category.trim() : "";
    const price = Number(body?.price);
    const stock = Number(body?.stock);
    const hasImage = Object.hasOwn(body || {}, "image");
    const image = hasImage ? body.image : "";
    if (
      !/^[\w-]{1,128}$/.test(businessId)
      || (request.method === "PATCH" && (!code || code.length > 128))
      || !name || name.length > 160
      || !barcode || barcode.length > 128
      || !category || category.length > 80
      || !Number.isSafeInteger(price) || price <= 0
      || !Number.isSafeInteger(stock) || stock < 0
    ) {
      return json({ error: "Data produk tidak valid." }, 400);
    }
    if (hasImage && !validProductImage(image)) {
      return json({ error: "Foto produk tidak valid atau terlalu besar." }, 400);
    }
    const business = await env.DB.prepare(
      "SELECT id FROM businesses WHERE id = ?"
    ).bind(businessId).first();
    if (!business) return json({ error: "Usaha tidak ditemukan." }, 404);

    const duplicate = await env.DB.prepare(
      "SELECT code FROM products WHERE business_id = ? AND barcode = ? AND code != ?"
    ).bind(businessId, barcode, request.method === "PATCH" ? code : "").first();
    if (duplicate) return json({ error: "Barcode sudah digunakan produk lain pada usaha ini." }, 409);

    if (request.method === "POST") {
      const next = await env.DB.prepare(
        "SELECT COALESCE(MAX(CAST(id AS INTEGER)), 0) + 1 AS number FROM products WHERE business_id = ?"
      ).bind(businessId).first();
      const id = String(next.number);
      const newCode = `K${String(next.number).padStart(2, "0")}`;
      await env.DB.prepare(
        "INSERT INTO products (id, business_id, code, barcode, name, category, price, stock, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(id, businessId, newCode, barcode, name, category, price, stock, image || "").run();
      return json({ success: true, code: newCode }, 201);
    }

    const result = await env.DB.prepare(
      `UPDATE products SET barcode = ?, name = ?, category = ?, price = ?, stock = ?,
        image = CASE WHEN ? = 1 THEN ? ELSE image END
       WHERE business_id = ? AND code = ?`
    ).bind(barcode, name, category, price, stock, hasImage ? 1 : 0, image || "", businessId, code).run();
    if (!result.meta.changes) return json({ error: "Produk tidak ditemukan." }, 404);
    return json({ success: true });
  }

  if (resource === "transactions" && request.method === "GET") {
    const where = search
      ? "WHERE instr(lower(transactions.id), lower(?)) > 0 OR instr(lower(businesses.name), lower(?)) > 0 OR instr(lower(users.username), lower(?)) > 0"
      : "";
    const bindings = search ? [search, search, search] : [];
    const [count, summary, result] = await Promise.all([
      env.DB.prepare(
        `SELECT COUNT(*) AS total
         FROM transactions
         JOIN businesses ON businesses.id = transactions.business_id
         JOIN users ON users.business_id = businesses.id
         ${where}`
      ).bind(...bindings).first(),
      env.DB.prepare(
        "SELECT COUNT(*) AS total, COALESCE(SUM(total), 0) AS sales FROM transactions"
      ).first(),
      env.DB.prepare(
        `SELECT transactions.id, transactions.business_id, transactions.waktu, transactions.total,
          transactions.payment_method, transactions.payment_label, businesses.name AS business_name, users.username,
          (SELECT COUNT(*) FROM transaction_items WHERE transaction_items.transaction_id = transactions.id) AS item_count
         FROM transactions
         JOIN businesses ON businesses.id = transactions.business_id
         JOIN users ON users.business_id = businesses.id
         ${where}
         ORDER BY transactions.waktu DESC, transactions.id DESC
         LIMIT 50 OFFSET ?`
      ).bind(...bindings, offset).all(),
    ]);
    return json({
      items: (result.results || []).map((row) => ({
        id: row.id,
        businessId: row.business_id,
        businessName: row.business_name,
        username: row.username,
        time: row.waktu,
        total: Number(row.total),
        paymentMethod: row.payment_method || "tunai",
        paymentLabel: row.payment_label || (row.payment_method === "qris" ? "QR" : "Tunai"),
        itemCount: Number(row.item_count) || 0,
      })),
      total: Number(count?.total) || 0,
      offset,
      limit: 50,
      summary: { count: Number(summary?.total) || 0, sales: Number(summary?.sales) || 0 },
    });
  }

  if (resource === "transaction" && request.method === "GET") {
    const id = url.searchParams.get("id") || "";
    if (!id || id.length > 128) return json({ error: "Transaksi yang dipilih tidak valid." }, 400);
    const transaction = await env.DB.prepare(
      `SELECT transactions.id, transactions.business_id, transactions.waktu, transactions.subtotal,
        transactions.diskon, transactions.ppn, transactions.total, transactions.dibayar,
        transactions.kembalian, transactions.member, transactions.payment_method, transactions.payment_label,
        businesses.name AS business_name, users.username
       FROM transactions
       JOIN businesses ON businesses.id = transactions.business_id
       JOIN users ON users.business_id = businesses.id
       WHERE transactions.id = ?`
    ).bind(id).first();
    if (!transaction) return json({ error: "Transaksi tidak ditemukan." }, 404);
    const items = await env.DB.prepare(
      "SELECT product_code AS code, name, price, qty FROM transaction_items WHERE transaction_id = ? ORDER BY rowid"
    ).bind(id).all();
    return json({
      ...transaction,
      subtotal: Number(transaction.subtotal),
      diskon: Number(transaction.diskon),
      ppn: Number(transaction.ppn),
      total: Number(transaction.total),
      dibayar: Number(transaction.dibayar),
      kembalian: Number(transaction.kembalian),
      member: Boolean(transaction.member),
      paymentMethod: transaction.payment_method || "tunai",
      paymentLabel: transaction.payment_label || (transaction.payment_method === "qris" ? "QR" : "Tunai"),
      items: (items.results || []).map((item) => ({
        code: item.code,
        name: item.name,
        price: Number(item.price),
        qty: Number(item.qty),
      })),
    });
  }

  if (resource === "payments" && request.method === "GET") {
    const where = search
      ? "WHERE instr(lower(businesses.name), lower(?)) > 0 OR instr(lower(users.username), lower(?)) > 0"
      : "";
    const bindings = search ? [search, search] : [];
    const [count, result] = await Promise.all([
      env.DB.prepare(
        `SELECT COUNT(*) AS total
         FROM businesses JOIN users ON users.business_id = businesses.id
         ${where}`
      ).bind(...bindings).first(),
      env.DB.prepare(
        `SELECT businesses.id AS business_id, businesses.name AS business_name, users.username,
          COALESCE(SUM(payment_qrs.is_enabled), 0) AS enabled_count,
          COUNT(payment_qrs.id) AS qr_count,
          MAX(payment_qrs.updated_at) AS updated_at
         FROM businesses
         JOIN users ON users.business_id = businesses.id
         LEFT JOIN business_payment_qrs AS payment_qrs ON payment_qrs.business_id = businesses.id
         ${where}
         GROUP BY businesses.id, businesses.name, users.username
         ORDER BY businesses.name
         LIMIT 50 OFFSET ?`
      ).bind(...bindings, offset).all(),
    ]);
    return json({
      items: (result.results || []).map((row) => ({
        businessId: row.business_id,
        businessName: row.business_name,
        username: row.username,
        qrisEnabled: Number(row.enabled_count) > 0,
        hasImage: Number(row.qr_count) > 0,
        qrCount: Number(row.qr_count) || 0,
        updatedAt: row.updated_at || "",
      })),
      total: Number(count?.total) || 0,
      offset,
      limit: 50,
    });
  }

  if (resource === "payment" && request.method === "GET") {
    const businessId = url.searchParams.get("businessId") || "";
    const business = await env.DB.prepare(
      "SELECT id, name FROM businesses WHERE id = ?"
    ).bind(businessId).first();
    if (!business) return json({ error: "Usaha tidak ditemukan." }, 404);
    const result = await env.DB.prepare(
      "SELECT id, name, image, is_enabled, updated_at FROM business_payment_qrs WHERE business_id = ? ORDER BY created_at, name"
    ).bind(businessId).all();
    const qrs = (result.results || []).map((row) => ({
      id: row.id,
      name: row.name,
      image: row.image,
      enabled: Boolean(row.is_enabled),
      updatedAt: row.updated_at,
    }));
    return json({
      businessId: business.id,
      businessName: business.name,
      qrisEnabled: qrs.some((qr) => qr.enabled),
      qrCount: qrs.length,
      qrs,
    });
  }

  if (resource === "payments" && request.method === "PATCH") {
    const body = await parseJsonBody(request);
    const businessId = typeof body?.businessId === "string" ? body.businessId : "";
    if (!/^[\w-]{1,128}$/.test(businessId) || typeof body?.qrisEnabled !== "boolean") {
      return json({ error: "Pengaturan QR tidak valid." }, 400);
    }
    const business = await env.DB.prepare(
      "SELECT id FROM businesses WHERE id = ?"
    ).bind(businessId).first();
    if (!business) return json({ error: "Usaha tidak ditemukan." }, 404);
    const settings = await env.DB.prepare(
      "SELECT COUNT(*) AS total FROM business_payment_qrs WHERE business_id = ?"
    ).bind(businessId).first();
    if (body.qrisEnabled && !Number(settings?.total)) {
      return json({ error: "QR usaha belum tersedia; pemilik usaha perlu mengunggahnya terlebih dahulu." }, 400);
    }
    await env.DB.prepare(
      "UPDATE business_payment_qrs SET is_enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE business_id = ?"
    ).bind(body.qrisEnabled ? 1 : 0, businessId).run();
    return json({ success: true, qrisEnabled: body.qrisEnabled });
  }

  if (resource === "alerts" && request.method === "GET") {
    const where = search
      ? "WHERE instr(lower(store_alerts.title), lower(?)) > 0 OR instr(lower(store_alerts.message), lower(?)) > 0 OR instr(lower(businesses.name), lower(?)) > 0"
      : "";
    const bindings = search ? [search, search, search] : [];
    const [count, result] = await Promise.all([
      env.DB.prepare(
        `SELECT COUNT(*) AS total
         FROM store_alerts JOIN businesses ON businesses.id = store_alerts.business_id
         ${where}`
      ).bind(...bindings).first(),
      env.DB.prepare(
        `SELECT store_alerts.id, store_alerts.business_id, businesses.name AS business_name,
          store_alerts.category, store_alerts.priority, store_alerts.title, store_alerts.message,
          store_alerts.status, store_alerts.created_at, store_alerts.updated_at
         FROM store_alerts JOIN businesses ON businesses.id = store_alerts.business_id
         ${where}
         ORDER BY CASE store_alerts.priority WHEN 'tinggi' THEN 0 WHEN 'sedang' THEN 1 ELSE 2 END,
          store_alerts.created_at DESC
         LIMIT 50 OFFSET ?`
      ).bind(...bindings, offset).all(),
    ]);
    return json({
      items: (result.results || []).map((row) => ({
        id: row.id,
        businessId: row.business_id,
        businessName: row.business_name,
        category: row.category,
        priority: row.priority,
        title: row.title,
        message: row.message,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
      total: Number(count?.total) || 0,
      offset,
      limit: 50,
    });
  }

  if (resource === "alerts" && request.method === "PATCH") {
    const body = await parseJsonBody(request);
    const id = typeof body?.id === "string" ? body.id : "";
    const businessId = typeof body?.businessId === "string" ? body.businessId : "";
    const status = body?.status;
    if (!id || id.length > 128 || !/^[\w-]{1,128}$/.test(businessId)
      || !["dibaca", "ditangani", "selesai", "tidak_relevan"].includes(status)) {
      return json({ error: "Perubahan status perhatian tidak valid." }, 400);
    }
    const result = await env.DB.prepare(
      `UPDATE store_alerts SET status = ?,
        read_at = CASE WHEN ? IN ('dibaca','ditangani','selesai') THEN COALESCE(read_at,CURRENT_TIMESTAMP) ELSE read_at END,
        resolved_at = CASE WHEN ? IN ('selesai','tidak_relevan') THEN CURRENT_TIMESTAMP ELSE NULL END,
        updated_at = CURRENT_TIMESTAMP
       WHERE business_id = ? AND id = ?`
    ).bind(status, status, status, businessId, id).run();
    if (!result.meta.changes) return json({ error: "Perhatian tidak ditemukan." }, 404);
    return json({ success: true });
  }

  return json({ error: "Data admin tidak ditemukan." }, 404);
}

function validProductImage(image) {
  // Gambar yang disimpan di D1 dibatasi ke data URL WebP kecil hasil kompresi browser.
  return typeof image === "string"
    && image.length <= MAX_PRODUCT_IMAGE_LENGTH
    && (image === "" || /^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/.test(image));
}

function parseAiJson(text) {
  const cleaned = text.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function getHelipodModel(env) {
  const configured = typeof env.HELIPOD_MODEL === "string" ? env.HELIPOD_MODEL.trim() : "";
  // Abaikan nilai contoh/placeholder agar tidak dikirim sebagai nama model.
  if (!configured || /^(MODEL_|ISI_|GANTI_|NAMA_MODEL)/i.test(configured) || /[\s<>]/.test(configured)) {
    return "gemini-3-flash";
  }
  return configured;
}

function extractAiError(data, rawText, status) {
  const message = data?.error?.message || data?.message || rawText || aiErrorMessage(status);
  return String(message).slice(0, 1200);
}

function aiErrorMessage(status) {
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

function validQrisImage(image) {
  return typeof image === "string"
    && image.length <= MAX_QRIS_IMAGE_LENGTH
    && (image === "" || /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(image));
}

function validQrisName(name) {
  return typeof name === "string" && name.trim().length > 0 && name.trim().length <= 40;
}

function validQrisCropSelection(selection) {
  return selection !== null
    && typeof selection === "object"
    && ["x", "y", "w", "h"].every((key) => Number.isFinite(selection[key]))
    && selection.x >= 0
    && selection.y >= 0
    && selection.w > 0
    && selection.h > 0
    && selection.x + selection.w <= 1
    && selection.y + selection.h <= 1;
}

function parseQrisCropSelection(value) {
  try {
    const selection = JSON.parse(value);
    return validQrisCropSelection(selection)
      ? { x: selection.x, y: selection.y, w: selection.w, h: selection.h }
      : { x: 0, y: 0, w: 1, h: 1 };
  } catch {
    return { x: 0, y: 0, w: 1, h: 1 };
  }
}

async function paymentSettingsApi(request, env, businessId) {
  if (request.method === "GET") {
    const includeSourceImage = new URL(request.url).searchParams.get("includeSource") === "1";
    const result = await env.DB.prepare(
      `SELECT id, name, image, source_image, crop_selection, is_enabled, created_at, updated_at
       FROM business_payment_qrs
       WHERE business_id = ?
       ORDER BY created_at, name`
    ).bind(businessId).all();
    return json({
      paymentQrs: (result.results || []).map((row) => ({
        id: row.id,
        name: row.name,
        image: row.image,
        ...(includeSourceImage ? {
          sourceImage: row.source_image || row.image,
          cropSelection: parseQrisCropSelection(row.crop_selection),
        } : {}),
        enabled: Boolean(row.is_enabled),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
      limit: MAX_QRIS_COUNT_PER_BUSINESS,
    });
  }

  const body = await parseJsonBody(request);

  if (request.method === "POST") {
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const image = typeof body?.image === "string" ? body.image : "";
    const sourceImage = typeof body?.sourceImage === "string" ? body.sourceImage : image;
    const cropSelection = body?.cropSelection === undefined
      ? { x: 0, y: 0, w: 1, h: 1 }
      : body.cropSelection;
    const enabled = body?.enabled === undefined ? true : body.enabled;
    if (
      !validQrisName(name)
      || typeof body?.image !== "string"
      || typeof enabled !== "boolean"
      || !validQrisCropSelection(cropSelection)
    ) {
      return json({ error: "Nama, gambar, atau status QR tidak valid." }, 400);
    }
    if (!image || !validQrisImage(image) || !sourceImage || !validQrisImage(sourceImage)) {
      return json({ error: "Gambar QR tidak valid atau terlalu besar." }, 400);
    }
    const [count, duplicate] = await Promise.all([
      env.DB.prepare(
        "SELECT COUNT(*) AS total FROM business_payment_qrs WHERE business_id = ?"
      ).bind(businessId).first(),
      env.DB.prepare(
        "SELECT id FROM business_payment_qrs WHERE business_id = ? AND name = ? COLLATE NOCASE"
      ).bind(businessId, name).first(),
    ]);
    if (Number(count?.total) >= MAX_QRIS_COUNT_PER_BUSINESS) {
      return json({
        code: "QR_LIMIT_REACHED",
        error: `Usaha ini sudah menyimpan ${MAX_QRIS_COUNT_PER_BUSINESS} QR. Hapus salah satu untuk menambahkan QR baru.`,
      }, 409);
    }
    if (duplicate) {
      return json({ code: "QR_NAME_EXISTS", error: "Nama ini sudah digunakan pada usaha ini. QR dengan nama yang sama tetap boleh digunakan oleh usaha lain." }, 409);
    }
    const id = `QR-${crypto.randomUUID()}`;
    await env.DB.prepare(
      `INSERT INTO business_payment_qrs
       (id, business_id, name, image, source_image, crop_selection, is_enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, businessId, name, image, sourceImage, JSON.stringify(cropSelection), enabled ? 1 : 0).run();
    return json({ success: true, qr: { id, name, image, enabled } }, 201);
  }

  if (request.method === "PUT") {
    const id = typeof body?.id === "string" ? body.id.trim() : "";
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const sourceImage = typeof body?.sourceImage === "string" ? body.sourceImage : body?.image;
    const cropSelection = body?.cropSelection === undefined
      ? { x: 0, y: 0, w: 1, h: 1 }
      : body.cropSelection;
    if (
      !id
      || id.length > 128
      || !validQrisName(name)
      || typeof body?.image !== "string"
      || !validQrisImage(body.image)
      || !body.image
      || !validQrisImage(sourceImage)
      || !sourceImage
      || !validQrisCropSelection(cropSelection)
    ) {
      return json({ error: "Nama, gambar, atau QR yang dipilih tidak valid." }, 400);
    }
    const [existing, duplicate] = await Promise.all([
      env.DB.prepare(
        "SELECT id FROM business_payment_qrs WHERE business_id = ? AND id = ?"
      ).bind(businessId, id).first(),
      env.DB.prepare(
        "SELECT id FROM business_payment_qrs WHERE business_id = ? AND name = ? COLLATE NOCASE AND id <> ?"
      ).bind(businessId, name, id).first(),
    ]);
    if (!existing) return json({ error: "QR tidak ditemukan pada usaha ini." }, 404);
    if (duplicate) return json({ error: "Nama QR sudah digunakan. Pilih nama lain." }, 409);
    await env.DB.prepare(
      `UPDATE business_payment_qrs
       SET name = ?, image = ?, source_image = ?, crop_selection = ?, updated_at = CURRENT_TIMESTAMP
       WHERE business_id = ? AND id = ?`
    ).bind(name, body.image, sourceImage, JSON.stringify(cropSelection), businessId, id).run();
    return json({ success: true });
  }

  if (request.method === "PATCH") {
    const id = typeof body?.id === "string" ? body.id.trim() : "";
    if (!id || id.length > 128 || typeof body?.enabled !== "boolean") {
      return json({ error: "QR atau status yang dipilih tidak valid." }, 400);
    }
    const result = await env.DB.prepare(
      `UPDATE business_payment_qrs SET is_enabled = ?, updated_at = CURRENT_TIMESTAMP
       WHERE business_id = ? AND id = ?`
    ).bind(body.enabled ? 1 : 0, businessId, id).run();
    if (!result.meta.changes) return json({ error: "QR tidak ditemukan pada usaha ini." }, 404);
    return json({ success: true });
  }

  if (request.method === "DELETE") {
    const id = new URL(request.url).searchParams.get("id") || "";
    if (!id || id.length > 128) return json({ error: "QR yang dipilih tidak valid." }, 400);
    const result = await env.DB.prepare(
      "DELETE FROM business_payment_qrs WHERE business_id = ? AND id = ?"
    ).bind(businessId, id).run();
    if (!result.meta.changes) return json({ error: "QR tidak ditemukan pada usaha ini." }, 404);
    return json({ success: true });
  }

  return json({ error: "Method tidak didukung" }, 405);
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
    "SELECT id, waktu, subtotal, diskon, ppn, total, dibayar, kembalian, member, payment_method, payment_label FROM transactions WHERE business_id = ? ORDER BY waktu DESC"
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
      metodePembayaran: row.payment_method || "tunai",
      labelPembayaran: row.payment_label || (row.payment_method === "qris" ? "QR" : "Tunai"),
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
  // Semua pembacaan dan penulisan riwayat dibatasi pada usaha dari sesi aktif.
  if (request.method === "GET") return json(await getTransactions(env, businessId));
  if (request.method !== "POST") return json({ error: "Method tidak didukung" }, 405);

  const body = await request.json();
  const items = Array.isArray(body.items) ? body.items : [];
  const paymentMethod = body.paymentMethod === undefined ? "tunai" : body.paymentMethod;
  const paymentQrId = typeof body.paymentQrId === "string" ? body.paymentQrId : "";
  const dibayarInput = Number(body.dibayar);
  const member = Boolean(body.member);
  if (!items.length) return json({ error: "Keranjang masih kosong" }, 400);
  if (!["tunai", "qris"].includes(paymentMethod)) {
    return json({ error: "Metode pembayaran tidak valid." }, 400);
  }
  if (paymentMethod === "tunai" && (!Number.isSafeInteger(dibayarInput) || dibayarInput < 0)) {
    return json({ error: "Jumlah pembayaran tidak valid" }, 400);
  }
  let paymentLabel = "Tunai";
  if (paymentMethod === "qris") {
    if (!paymentQrId || paymentQrId.length > 128) {
      return json({ error: "Pilih QR yang akan digunakan." }, 400);
    }
    const qr = await env.DB.prepare(
      "SELECT name, image FROM business_payment_qrs WHERE business_id = ? AND id = ? AND is_enabled = 1"
    ).bind(businessId, paymentQrId).first();
    if (!qr?.image || body.qrisConfirmed !== true) {
      return json({ error: "QR belum siap atau pembayaran belum dikonfirmasi." }, 400);
    }
    paymentLabel = qr.name;
  }

  // Ambil ulang harga dan stok dari D1; data harga/total dari browser tidak dipercaya.
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
  const dibayar = paymentMethod === "qris" ? total : dibayarInput;
  if (dibayar < total) return json({ error: "Uang pembayaran kurang" }, 400);
  const kembalian = dibayar - total;
  const waktu = new Date().toISOString();
  const transactionId = `TRX-${crypto.randomUUID()}`;
  const statements = [
    env.DB.prepare(
      "INSERT INTO transactions (id, business_id, waktu, subtotal, diskon, ppn, total, dibayar, kembalian, member, payment_method, payment_label) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(transactionId, businessId, waktu, subtotal, diskon, ppn, total, dibayar, kembalian, member ? 1 : 0, paymentMethod, paymentLabel),
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
  // Simpan transaksi, item, dan pengurangan stok bersama-sama agar checkout konsisten.
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
      metodePembayaran: paymentMethod,
      labelPembayaran: paymentLabel,
      member,
      items: verified.map((item) => ({ kode: item.code, nama: item.name, harga: item.price, qty: item.qty })),
    },
  }, 201);
}

function insightRecommendation(priority, category, title, evidence, action, reason) {
  return { priority, category, title, evidence, action, reason };
}

function buildInsightRecommendations(facts, focus) {
  const recommendations = [];
  const add = (item) => recommendations.push(item);
  const stockRisks = facts.risiko_stok || [];
  for (const item of stockRisks.slice(0, 4)) {
    add(insightRecommendation(
      item.hari_tersisa !== null && item.hari_tersisa <= 3 ? "tinggi" : "sedang",
      "stok",
      item.stok === 0 ? `Stok ${item.nama} sudah habis` : `Periksa stok ${item.nama}`,
      `${item.terjual_7_hari} unit terjual dalam 7 hari; stok saat ini ${item.stok}${item.stok > 0 && item.hari_tersisa !== null ? `, perkiraan cukup ${item.hari_tersisa} hari` : ""}.`,
      item.stok === 0 ? `Periksa kebutuhan dan lakukan restok ${item.nama} jika produk masih ingin dijual.` : `Periksa stok fisik dan pertimbangkan restok ${item.nama} sebelum persediaan habis.`,
      "Rekomendasi dihitung dari laju penjualan terbaru dan stok yang tercatat."
    ));
  }

  if (facts.tren_penjualan.status === "naik") {
    add(insightRecommendation("sedang", "penjualan", "Penjualan sedang meningkat", facts.tren_penjualan.keterangan,
      "Pastikan produk yang paling banyak dicari tetap tersedia dan pertimbangkan menambah penempatan produk tersebut.",
      "Kenaikan penjualan perlu diikuti kesiapan stok agar peluang tidak terlewat."));
  } else if (facts.tren_penjualan.status === "turun") {
    add(insightRecommendation("sedang", "penjualan", "Penjualan lebih rendah dari pekan sebelumnya", facts.tren_penjualan.keterangan,
      "Periksa apakah produk utama sering kosong, jam buka berubah, atau pelanggan membutuhkan pilihan produk lain sebelum membuat promo.",
      "Periksa penyebab terlebih dahulu agar tindakan yang dipilih sesuai kondisi toko."));
  }

  if (facts.produk_terlaris_7_hari.length) {
    const top = facts.produk_terlaris_7_hari[0];
    add(insightRecommendation("informasi", "produk", `Pertahankan ketersediaan ${top.nama}`,
      `${top.qty} unit terjual dalam 7 hari terakhir.`,
      `Pastikan ${top.nama} mudah ditemukan dan stoknya dipantau setiap hari.`,
      "Produk dengan penjualan tertinggi layak dipantau agar tidak kehilangan momentum."));
  }
  const pair = (facts.kombinasi_produk || []).find((item) => item.transaksi_bersama >= 2);
  if (pair) {
    add(insightRecommendation("informasi", "penjualan", "Dua produk sering dibeli bersama",
      `${pair.produk[0]} dan ${pair.produk[1]} muncul bersama dalam ${pair.transaksi_bersama} transaksi selama 30 hari terakhir.`,
      "Pertimbangkan menempatkan kedua produk berdekatan agar pelanggan mudah menemukannya. Tidak perlu memberi diskon sebelum mengetahui margin masing-masing produk.",
      "Pola ini berasal dari kombinasi item dalam transaksi yang tersimpan."));
  }

  for (const item of (facts.produk_tidak_bergerak || []).slice(0, 3)) {
    add(insightRecommendation("sedang", "produk_lambat", `Evaluasi ${item.nama} yang belum terjual`,
      `Stok tercatat ${item.stok} unit dan tidak ada penjualan produk ini dalam 30 hari terakhir.`,
      `Periksa kondisi, penempatan, dan kebutuhan pelanggan sebelum memutuskan membeli stok tambahan ${item.nama}. Jika produk baru ditambahkan, kumpulkan data lebih lama sebelum mengambil keputusan.`,
      "Tanggal produk ditambahkan belum tersedia, jadi sistem tidak dapat membedakan produk baru dari stok lama."));
  }

  if (!facts.jumlah_transaksi) {
    add(insightRecommendation("informasi", "data", "Mulai catat transaksi harian",
      "Belum ada transaksi yang tercatat pada usaha ini.",
      "Gunakan halaman Kasir untuk mencatat transaksi. Setelah data terkumpul, Smart Insight dapat membaca pola penjualan dan stok.",
      "Analisis belum dapat dibuat tanpa data transaksi."));
  }

  const priorityOrder = { tinggi: 0, sedang: 1, informasi: 2 };
  const focusOrder = {
    automatic: [],
    sales: ["penjualan", "produk", "stok", "produk_lambat"],
    stock: ["stok", "produk", "produk_lambat", "penjualan"],
    best_sellers: ["produk", "stok", "penjualan", "produk_lambat"],
    slow_movers: ["produk_lambat", "stok", "penjualan", "produk"],
    hours: ["waktu", "penjualan", "produk", "stok"],
  }[focus] || [];
  recommendations.sort((a, b) => {
    const pa = priorityOrder[a.priority] ?? 3;
    const pb = priorityOrder[b.priority] ?? 3;
    if (pa !== pb) return pa - pb;
    const fa = focusOrder.indexOf(a.category);
    const fb = focusOrder.indexOf(b.category);
    return (fa < 0 ? 99 : fa) - (fb < 0 ? 99 : fb);
  });
  return recommendations.slice(0, 8);
}

function buildInsightSummary(facts, focus) {
  const soldAmount = rupiah(facts.penjualan_7_hari);
  const transactionCount = Number(facts.transaksi_7_hari || 0);
  const salesPrefix = `Dalam 7 hari terakhir tercatat ${transactionCount} transaksi dengan penjualan ${soldAmount}.`;

  if (focus === "sales") {
    const trend = facts.tren_penjualan;
    if (trend.status === "naik" || trend.status === "turun" || trend.status === "stabil") {
      return `Fokus peningkatan penjualan: ${trend.keterangan} Periksa rekomendasi untuk melihat langkah yang dapat dipertimbangkan.`;
    }
    return `Fokus peningkatan penjualan: ${salesPrefix} ${trend.keterangan}`;
  }

  if (focus === "stock") {
    const risks = facts.risiko_stok || [];
    if (!risks.length) {
      return `Fokus pengelolaan stok: ${salesPrefix} Belum ada produk yang terdeteksi berisiko habis berdasarkan stok dan penjualan 7 hari terakhir.`;
    }
    const products = risks.slice(0, 3).map((item) =>
      `${item.nama} (stok ${item.stok}, terjual ${item.terjual_7_hari} unit)`
    ).join(", ");
    return `Fokus pengelolaan stok: ${risks.length} produk perlu diperiksa berdasarkan penjualan 7 hari terakhir, termasuk ${products}.`;
  }

  if (focus === "best_sellers") {
    const products = facts.produk_terlaris_7_hari || [];
    if (!products.length) {
      return `Fokus produk terlaris: belum ada produk yang tercatat terjual dalam 7 hari terakhir. ${salesPrefix}`;
    }
    const topProducts = products.slice(0, 3)
      .map((item) => `${item.nama} (${item.qty} unit)`)
      .join(", ");
    return `Fokus produk terlaris: dalam 7 hari terakhir produk dengan penjualan tertinggi adalah ${topProducts}.`;
  }

  if (focus === "slow_movers") {
    if (Number(facts.periode_data_hari || 0) < 30) {
      return `Fokus produk kurang laku: data transaksi belum mencakup 30 hari, jadi sistem belum dapat menilai produk yang tidak terjual selama 30 hari. ${salesPrefix}`;
    }
    const products = facts.produk_tidak_bergerak || [];
    if (!products.length) {
      return `Fokus produk kurang laku: tidak ditemukan produk dengan stok tersisa yang tanpa penjualan selama 30 hari terakhir.`;
    }
    const names = products.slice(0, 3).map((item) => `${item.nama} (stok ${item.stok})`).join(", ");
    return `Fokus produk kurang laku: ${products.length} produk masih memiliki stok tetapi tidak tercatat terjual dalam 30 hari terakhir, termasuk ${names}.`;
  }

  if (!facts.jumlah_transaksi) {
    return "Belum ada transaksi yang cukup untuk menyimpulkan pola penjualan. Mulai catat transaksi agar analisis dapat terbentuk.";
  }
  return `${salesPrefix} ${facts.tren_penjualan.keterangan}`;
}

const SMART_INSIGHT_CACHE_TTL_SECONDS = 600;
const SMART_INSIGHT_MAX_PROMPT_CHARS = 6000;
const SMART_INSIGHT_MAX_OUTPUT_TOKENS = 120;

function clipInsightText(value, maxLength) {
  return String(value ?? "").slice(0, maxLength);
}

function buildCompactInsightContext(facts, recommendations) {
  return {
    facts: {
      jumlah_transaksi: facts.jumlah_transaksi,
      transaksi_7_hari: facts.transaksi_7_hari,
      total_penjualan: facts.total_penjualan,
      penjualan_7_hari: facts.penjualan_7_hari,
      tren_penjualan: {
        status: facts.tren_penjualan.status,
        keterangan: clipInsightText(facts.tren_penjualan.keterangan, 160),
      },
      produk_terlaris_7_hari: facts.produk_terlaris_7_hari.slice(0, 3).map((item) => ({
        nama: clipInsightText(item.nama, 60),
        qty: item.qty,
      })),
      risiko_stok: facts.risiko_stok.slice(0, 4).map((item) => ({
        nama: clipInsightText(item.nama, 60),
        stok: item.stok,
        terjual_7_hari: item.terjual_7_hari,
        hari_tersisa: item.hari_tersisa,
      })),
      produk_tidak_bergerak: facts.produk_tidak_bergerak.slice(0, 3).map((item) => ({
        nama: clipInsightText(item.nama, 60),
        stok: item.stok,
      })),
      kombinasi_produk: facts.kombinasi_produk.slice(0, 2).map((item) => ({
        produk: item.produk.slice(0, 2).map((name) => clipInsightText(name, 50)),
        transaksi_bersama: item.transaksi_bersama,
      })),
    },
    recommendations: recommendations.slice(0, 1).map((item) => ({
      priority: item.priority,
      title: clipInsightText(item.title, 80),
      evidence: clipInsightText(item.evidence, 120),
      action: clipInsightText(item.action, 140),
    })),
  };
}

async function createSmartInsightCacheKey(request, businessId, focus, model, prompt) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${model}\n${prompt}`));
  const fingerprint = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const origin = new URL(request.url).origin;
  return new Request(`${origin}/__smart-insight-cache/${encodeURIComponent(businessId)}/${focus}/${fingerprint}`);
}

async function smartInsightApi(request, env, businessId) {
  // Satu JOIN mengambil transaksi dan item sekaligus; seluruh data dibatasi pada business_id sesi.
  const body = await parseJsonBody(request) || {};
  const allowedFocus = new Set(["automatic", "sales", "stock", "best_sellers", "slow_movers", "hours"]);
  const focus = allowedFocus.has(body.focus) ? body.focus : "automatic";
  const [transactionRows, productsResult] = await Promise.all([
    env.DB.prepare(`
      SELECT t.id, t.waktu, t.subtotal, t.total, ti.product_code, ti.name AS item_name, ti.qty
      FROM transactions t
      LEFT JOIN transaction_items ti ON ti.transaction_id = t.id
      WHERE t.business_id = ?
      ORDER BY t.waktu DESC
    `).bind(businessId).all(),
    env.DB.prepare("SELECT code, name, category, price, stock FROM products WHERE business_id = ? ORDER BY name")
      .bind(businessId).all(),
  ]);
  const products = productsResult.results || [];
  const productMap = new Map(products.map((item) => [item.code, item]));
  const txMap = new Map();
  const productStats = new Map();
  const pairCounts = new Map();
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const current7 = now - 7 * dayMs;
  const previous7 = now - 14 * dayMs;
  const current30 = now - 30 * dayMs;
  let totalAll = 0;
  let oldestTransactionTimestamp = Infinity;
  let total7 = 0;
  let totalPrevious7 = 0;
  let count7 = 0;
  let countPrevious7 = 0;
  let count30 = 0;

  for (const row of transactionRows.results || []) {
    let tx = txMap.get(row.id);
    if (!tx) {
      const timestamp = Date.parse(row.waktu);
      tx = { id: row.id, timestamp, waktu: row.waktu, total: Number(row.total || 0), items: [] };
      txMap.set(row.id, tx);
      totalAll += tx.total;
      if (Number.isFinite(timestamp)) {
        oldestTransactionTimestamp = Math.min(oldestTransactionTimestamp, timestamp);
        if (timestamp >= current7) { total7 += tx.total; count7 += 1; }
        else if (timestamp >= previous7 && timestamp < current7) { totalPrevious7 += tx.total; countPrevious7 += 1; }
        if (timestamp >= current30) count30 += 1;
      }
    }
    if (row.product_code && row.qty !== null) {
      const qty = Number(row.qty || 0);
      tx.items.push({ code: row.product_code, name: row.item_name, qty });
      const stat = productStats.get(row.product_code) || { code: row.product_code, name: row.item_name, all: 0, seven: 0, thirty: 0 };
      stat.all += qty;
      if (Number.isFinite(tx.timestamp)) {
        if (tx.timestamp >= current7) stat.seven += qty;
        if (tx.timestamp >= current30) stat.thirty += qty;
      }
      productStats.set(row.product_code, stat);
    }
  }

  // Hitung kombinasi produk yang muncul dalam transaksi yang sama, tanpa query per transaksi.
  for (const tx of txMap.values()) {
    if (!Number.isFinite(tx.timestamp) || tx.timestamp < current30 || tx.items.length < 2) continue;
    const codes = [...new Set(tx.items.map((item) => item.code))].sort();
    for (let i = 0; i < codes.length; i++) for (let j = i + 1; j < codes.length; j++) {
      const key = `${codes[i]}::${codes[j]}`;
      pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
    }
  }

  const sortedStats = [...productStats.values()].sort((a, b) => b.seven - a.seven || b.all - a.all);
  const topAll = [...productStats.values()].sort((a, b) => b.all - a.all).slice(0, 5)
    .map((item) => ({ code: item.code, name: productMap.get(item.code)?.name || item.name, qty: item.all }));
  const top7 = sortedStats.filter((item) => item.seven > 0).slice(0, 5)
    .map((item) => ({ code: item.code, nama: productMap.get(item.code)?.name || item.name, qty: item.seven }));
  const lowStock = products.filter((item) => Number(item.stock) <= 10)
    .sort((a, b) => Number(a.stock) - Number(b.stock)).slice(0, 10)
    .map((item) => ({ code: item.code, name: item.name, stock: Number(item.stock), category: item.category }));
  const risikoStok = products.map((item) => {
    const stat = productStats.get(item.code);
    const sold7 = stat?.seven || 0;
    const dailyRate = sold7 / 7;
    const stock = Number(item.stock || 0);
    const daysLeft = dailyRate > 0 ? Math.floor(stock / dailyRate) : null;
    return { code: item.code, nama: item.name, stok: stock, terjual_7_hari: sold7, hari_tersisa: daysLeft };
  }).filter((item) => item.terjual_7_hari > 0 && (item.stok === 0 || item.hari_tersisa <= 7))
    .sort((a, b) => (a.hari_tersisa ?? -1) - (b.hari_tersisa ?? -1));
  const historyDays = Number.isFinite(oldestTransactionTimestamp) ? Math.floor((now - oldestTransactionTimestamp) / dayMs) : 0;
  const slowMovers = historyDays >= 30
    ? products.filter((item) => Number(item.stock) > 0 && !(productStats.get(item.code)?.thirty > 0))
      .slice(0, 8).map((item) => ({ nama: item.name, stok: Number(item.stock) }))
    : [];
  const topPairs = [...pairCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([key, count]) => {
    const [a, b] = key.split("::");
    return { produk: [productMap.get(a)?.name || a, productMap.get(b)?.name || b], transaksi_bersama: count };
  });
  let trend = { status: "belum_cukup", keterangan: "Belum ada pembanding 7 hari sebelumnya yang memadai." };
  if (countPrevious7 > 0) {
    const delta = totalPrevious7 > 0 ? ((total7 - totalPrevious7) / totalPrevious7) * 100 : null;
    const roundedDelta = delta === null ? null : Math.round(delta);
    trend = delta === null
      ? { status: "baru_tercatat", keterangan: `Penjualan 7 hari terakhir ${rupiah(total7)}; periode pembanding belum memiliki nilai penjualan.` }
      : { status: roundedDelta >= 10 ? "naik" : roundedDelta <= -10 ? "turun" : "stabil", perubahan_persen: roundedDelta, keterangan: `Penjualan 7 hari terakhir ${rupiah(total7)} dibanding ${rupiah(totalPrevious7)} pada 7 hari sebelumnya (${roundedDelta >= 0 ? "+" : ""}${roundedDelta}%).` };
  }

  const facts = {
    jumlah_transaksi: txMap.size,
    transaksi_7_hari: count7,
    transaksi_30_hari: count30,
    periode_data_hari: historyDays,
    total_penjualan: totalAll,
    penjualan_7_hari: total7,
    penjualan_7_hari_sebelumnya: totalPrevious7,
    tren_penjualan: trend,
    produk_terlaris: topAll,
    produk_terlaris_7_hari: top7,
    stok_menipis: lowStock,
    risiko_stok: risikoStok,
    produk_tidak_bergerak: slowMovers,
    kombinasi_produk: topPairs,
    catatan_jam_ramai: "Zona waktu toko belum dikonfigurasi; analisis jam ramai ditunda agar tidak menampilkan jam yang keliru.",
  };
  const recommendations = buildInsightRecommendations(facts, focus);
  const fallback = {
    ringkasan: buildInsightSummary(facts, focus),
    produk_terlaris: top7.length ? `${top7[0].nama} terjual ${top7[0].qty} unit dalam 7 hari terakhir.` : "Belum ada penjualan produk dalam 7 hari terakhir.",
    stok_menipis: risikoStok.length ? risikoStok.slice(0, 3).map((item) => `${item.nama}: stok ${item.stok}, terjual ${item.terjual_7_hari} unit/7 hari`).join("; ") : "Belum ditemukan risiko stok berdasarkan laju penjualan 7 hari terakhir.",
    jam_ramai: facts.catatan_jam_ramai,
    saran_penjualan: recommendations[0]?.action || "Lanjutkan pencatatan transaksi agar rekomendasi semakin akurat.",
    kartu: [
      { judul: "Penjualan 7 hari", isi: rupiah(total7), tipe: "success" },
      { judul: "Transaksi 7 hari", isi: String(count7), tipe: "info" },
      { judul: "Risiko stok", isi: `${risikoStok.length} produk`, tipe: risikoStok.length ? "warning" : "success" },
      { judul: "Produk bergerak", isi: `${top7.length} produk terjual`, tipe: "info" },
    ],
  };

  if (!env.HELIPOD_API_KEY) {
    return json({ success: false, needs_key: true, message: "Analisis berbasis data tetap tersedia tanpa AI.", setup: "Pengelola dapat mengaktifkan AI melalui secret HELIPOD_API_KEY.", facts, recommendations, insight: fallback, focus });
  }

  const model = getHelipodModel(env);
  const compactContext = buildCompactInsightContext(facts, recommendations);
  const prompt = `Anda adalah pendamping usaha mikro Indonesia. Gunakan bahasa Indonesia yang sederhana, hangat, tidak menggurui, dan langsung bisa dilakukan.
Fokus pemilik: ${focus}. Prioritaskan rekomendasi yang relevan dengan fokus tersebut, tetapi jangan abaikan risiko stok yang mendesak.
Temuan dan bukti dari rekomendasi sistem adalah fakta. Berikan satu saran AI yang lebih spesifik dan berguna untuk temuan prioritas pertama; jangan sekadar menyalin tindakan sistem. Jangan mengarang angka, nama produk, harga modal, laba, maupun jam ramai. Jangan menyarankan diskon/harga tanpa data margin.
Tindakan harus realistis, singkat, dan dapat dilakukan pemilik, bukan nasihat umum. Keluarkan hanya dua baris teks biasa tanpa JSON atau markdown:
Tindakan: [satu saran maksimal 180 karakter]
Alasan: [alasan maksimal 100 karakter]
FAKTA DAN REKOMENDASI: ${JSON.stringify(compactContext)}`;
  if (prompt.length > SMART_INSIGHT_MAX_PROMPT_CHARS) {
    console.warn("[HELIPOD INSIGHT INPUT LIMIT]", { businessId, promptChars: prompt.length });
    return json({
      success: false,
      error: "Analisis AI dilewati agar data yang dikirim tetap terbatas.",
      detail: "Ringkasan dan rekomendasi berbasis data tetap tersedia.",
      facts,
      recommendations,
      recommendations_source: "worker",
      insight: fallback,
      focus
    });
  }

  const cache = globalThis.caches?.default;
  let cacheKey;
  if (cache) {
    try {
      cacheKey = await createSmartInsightCacheKey(request, businessId, focus, model, prompt);
      const cachedResponse = await cache.match(cacheKey);
      if (cachedResponse) {
        const cachedInsight = await cachedResponse.json();
        const candidates = recommendations.slice(0, 1);
        if (typeof cachedInsight.ringkasan === "string"
          && Array.isArray(cachedInsight.recommendations)
          && cachedInsight.recommendations.length === candidates.length
          && cachedInsight.recommendations.every((item) => typeof item?.action === "string" && typeof item?.reason === "string")) {
          const aiRecommendations = candidates.map((item, index) => ({
            ...item,
            action: cachedInsight.recommendations[index].action,
            reason: cachedInsight.recommendations[index].reason,
          }));
          return json({
            success: true,
            facts,
            recommendations: aiRecommendations,
            recommendations_source: "ai",
            insight: {
              ...fallback,
              ringkasan: cachedInsight.ringkasan,
              saran_penjualan: aiRecommendations[0]?.action || fallback.saran_penjualan,
            },
            focus,
            source: "Helipod + cache",
            cache_hit: true,
          });
        }
      }
    } catch (error) {
      console.error("[SMART_INSIGHT_CACHE READ ERROR]", { businessId, message: error?.message || String(error) });
      cacheKey = undefined;
    }
  }

  try {
    const response = await fetch("https://ai.helipod.io/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.HELIPOD_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: SMART_INSIGHT_MAX_OUTPUT_TOKENS,
      }),
    });
    const rawResponse = await response.text();
    let providerResponse = {};
    try { providerResponse = rawResponse ? JSON.parse(rawResponse) : {}; } catch { providerResponse = {}; }
    if (!response.ok) {
      const providerMessage = extractAiError(providerResponse, rawResponse, response.status)
        .replaceAll(env.HELIPOD_API_KEY, "[redacted]");
      console.error("[HELIPOD INSIGHT ERROR]", { status: response.status, model, message: providerMessage });
      return json({
        success: false,
        error: "Layanan AI belum dapat digunakan",
        detail: `${aiErrorMessage(response.status)} Detail: ${providerMessage}. Rekomendasi berbasis data tetap ditampilkan.`,
        facts,
        recommendations,
        recommendations_source: "worker",
        insight: fallback,
        focus
      }, response.status === 429 || response.status >= 500 ? 503 : 502);
    }
    const messageContent = providerResponse.choices?.[0]?.message?.content;
    const responseText = (typeof messageContent === "string"
      ? messageContent
      : Array.isArray(messageContent)
        ? messageContent.map((part) => typeof part === "string" ? part : part?.text || "").join("\n")
        : "").replace(/```(?:json|text)?/gi, "").replace(/```/g, "").trim();
    const generated = parseAiJson(responseText);
    const candidates = recommendations.slice(0, 1);
    const generatedItem = Array.isArray(generated?.rekomendasi) ? generated.rekomendasi[0] : null;
    const structuredAction = [
      generated?.tindakan,
      generated?.saran_penjualan,
      generated?.action,
      generated?.saran,
      generatedItem?.tindakan,
      generatedItem?.action,
    ].find((value) => typeof value === "string" && value.trim());
    const generatedAction = structuredAction
      || responseText.match(/\*{0,2}\s*(?:tindakan|saran(?: utama)?)\s*\*{0,2}\s*:\s*([\s\S]*?)(?=\n\s*\*{0,2}\s*alasan\s*\*{0,2}\s*:|$)/i)?.[1]
      || (/^[\[{]/.test(responseText) ? "" : responseText);
    if (!candidates.length || typeof generatedAction !== "string" || !generatedAction.trim()) {
      return json({
        success: false,
        error: "AI belum memberikan saran yang bisa digunakan.",
        detail: "Saran cadangan berdasarkan data sistem ditampilkan.",
        facts,
        recommendations,
        recommendations_source: "worker",
        insight: fallback,
        focus,
      });
    }
    const aiRecommendations = [{
      ...candidates[0],
      action: clipInsightText(generatedAction.trim(), 180),
      reason: typeof generated?.alasan === "string"
        ? clipInsightText(generated.alasan.trim(), 100)
        : typeof generatedItem?.alasan === "string"
          ? clipInsightText(generatedItem.alasan.trim(), 100)
          : responseText.match(/(?:^|\n)\s*\*{0,2}\s*alasan\s*\*{0,2}\s*:\s*([^\n]+)/i)?.[1]?.trim() || "",
    }];
    const safeInsight = {
      ...fallback,
      saran_penjualan: aiRecommendations[0]?.action || fallback.saran_penjualan,
    };
    if (cache && cacheKey) {
      try {
        await cache.put(cacheKey, new Response(JSON.stringify({
          ringkasan: safeInsight.ringkasan,
          recommendations: aiRecommendations.map((item) => ({
            action: item.action,
            reason: item.reason,
          })),
        }), {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": `public, max-age=${SMART_INSIGHT_CACHE_TTL_SECONDS}`,
          },
        }));
      } catch (error) {
        console.error("[SMART_INSIGHT_CACHE WRITE ERROR]", { businessId, message: error?.message || String(error) });
      }
    }
    return json({
      success: true,
      facts,
      recommendations: aiRecommendations,
      recommendations_source: "ai",
      insight: safeInsight,
      focus,
      source: "Helipod + analisis data",
    });
  } catch (error) {
    console.error("[HELIPOD INSIGHT NETWORK ERROR]", { model, message: error?.message || String(error) });
    return json({ success: false, error: "Layanan AI tidak dapat dijangkau", detail: `${error?.message || "Koneksi ke Helipod gagal."} Saran cadangan berdasarkan data sistem ditampilkan.`, facts, recommendations, recommendations_source: "worker", insight: fallback, focus }, 503);
  }
}


// Pusat Perhatian Toko: deteksi berbasis data yang benar-benar tersedia di D1.
async function refreshStoreAlerts(env, businessId) {
  const [productsResult, salesResult] = await Promise.all([
    env.DB.prepare("SELECT code, name, stock FROM products WHERE business_id = ?").bind(businessId).all(),
    env.DB.prepare(`
      SELECT ti.product_code, SUM(ti.qty) AS qty
      FROM transaction_items ti
      JOIN transactions t ON t.id = ti.transaction_id
      WHERE t.business_id = ? AND t.waktu >= ?
      GROUP BY ti.product_code
    `).bind(businessId, new Date(Date.now() - 7 * 86400000).toISOString()).all(),
  ]);
  const sold = new Map((salesResult.results || []).map(row => [row.product_code, Number(row.qty || 0)]));
  const detected = [];
  for (const product of productsResult.results || []) {
    const stock = Number(product.stock || 0);
    const sold7 = sold.get(product.code) || 0;
    if (stock <= 0) {
      detected.push({ key: `stock-empty:${product.code}`, category: "stok", priority: "tinggi",
        title: `Stok ${product.name} sudah habis`,
        message: `Persediaan ${product.name} tercatat 0 unit.`,
        evidence: { product_code: product.code, stock, sold_7_days: sold7 },
        action_label: "Lihat Produk", action_type: "product", action_payload: { code: product.code } });
    } else if (stock <= 5 || (sold7 > 0 && Math.floor(stock / (sold7 / 7)) <= 7)) {
      detected.push({ key: `stock-low:${product.code}`, category: "stok", priority: stock <= 2 ? "tinggi" : "sedang",
        title: `Stok ${product.name} perlu diperiksa`,
        message: `Stok tersisa ${stock} unit${sold7 ? ` dan ${sold7} unit terjual dalam 7 hari terakhir` : ""}.`,
        evidence: { product_code: product.code, stock, sold_7_days: sold7 },
        action_label: "Lihat Produk", action_type: "product", action_payload: { code: product.code } });
    }
  }
  const [cur, prev] = await Promise.all([
    env.DB.prepare("SELECT COALESCE(SUM(total),0) AS total, COUNT(*) AS n FROM transactions WHERE business_id = ? AND waktu >= ?")
      .bind(businessId, new Date(Date.now() - 7 * 86400000).toISOString()).first(),
    env.DB.prepare("SELECT COALESCE(SUM(total),0) AS total, COUNT(*) AS n FROM transactions WHERE business_id = ? AND waktu >= ? AND waktu < ?")
      .bind(businessId, new Date(Date.now() - 14 * 86400000).toISOString(), new Date(Date.now() - 7 * 86400000).toISOString()).first(),
  ]);
  if (Number(prev?.n) > 0 && Number(prev.total) > 0) {
    const change = ((Number(cur.total) - Number(prev.total)) / Number(prev.total)) * 100;
    if (change <= -20) detected.push({ key: "sales-drop-7d", category: "penjualan", priority: "sedang",
      title: "Penjualan menurun dibanding pekan sebelumnya",
      message: `Penjualan 7 hari terakhir turun ${Math.round(Math.abs(change))}% dibanding 7 hari sebelumnya.`,
      evidence: { current_7_days: Number(cur.total), previous_7_days: Number(prev.total), change_percent: Math.round(change) },
      action_label: "Lihat Analisis", action_type: "insight", action_payload: {} });
    else if (change >= 20) detected.push({ key: "sales-rise-7d", category: "penjualan", priority: "info",
      title: "Penjualan meningkat",
      message: `Penjualan 7 hari terakhir naik ${Math.round(change)}% dibanding 7 hari sebelumnya.`,
      evidence: { current_7_days: Number(cur.total), previous_7_days: Number(prev.total), change_percent: Math.round(change) },
      action_label: "Lihat Smart Insight", action_type: "insight", action_payload: {} });
  }
  const active = await env.DB.prepare("SELECT id, alert_key FROM store_alerts WHERE business_id = ? AND status IN ('baru','dibaca','ditangani')")
    .bind(businessId).all();
  const keys = new Set(detected.map(item => item.key));
  const statements = detected.map(item => env.DB.prepare(`
    INSERT INTO store_alerts
      (id,business_id,alert_key,category,priority,title,message,evidence_json,action_label,action_type,action_payload_json,status,first_seen_at,last_seen_at,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,'baru',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
    ON CONFLICT(business_id,alert_key) WHERE status IN ('baru','dibaca','ditangani')
    DO UPDATE SET category=excluded.category,priority=excluded.priority,title=excluded.title,message=excluded.message,
      evidence_json=excluded.evidence_json,action_label=excluded.action_label,action_type=excluded.action_type,
      action_payload_json=excluded.action_payload_json,last_seen_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP
  `).bind(crypto.randomUUID(), businessId, item.key, item.category, item.priority, item.title, item.message,
    JSON.stringify(item.evidence), item.action_label, item.action_type, JSON.stringify(item.action_payload)));
  for (const row of active.results || []) {
    if (!keys.has(row.alert_key)) statements.push(env.DB.prepare(
      "UPDATE store_alerts SET status='selesai',resolved_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE business_id=? AND id=? AND status IN ('baru','dibaca','ditangani')"
    ).bind(businessId, row.id));
  }
  if (statements.length) await env.DB.batch(statements);
}

async function storeAlertsApi(request, env, businessId, pathname) {
  if (request.method === "GET" && pathname === "/api/store-alerts") {
    try {
      await refreshStoreAlerts(env, businessId);
      const result = await env.DB.prepare("SELECT * FROM store_alerts WHERE business_id=? ORDER BY CASE priority WHEN 'tinggi' THEN 0 WHEN 'sedang' THEN 1 ELSE 2 END, created_at DESC LIMIT 100")
        .bind(businessId).all();
      const unread = await env.DB.prepare("SELECT COUNT(*) AS n FROM store_alerts WHERE business_id=? AND status='baru'").bind(businessId).first();
      return json({ alerts: (result.results || []).map(row => ({ ...row, evidence: JSON.parse(row.evidence_json || "{}"), action_payload: JSON.parse(row.action_payload_json || "{}") })), unread: Number(unread?.n || 0) });
    } catch (error) {
      const detail = error?.message || String(error);
      console.error("[STORE ALERTS REFRESH ERROR]", { businessId, message: detail });
      if (/no such table:\s*store_alerts/i.test(detail)) {
        return json({ error: "Pusat Perhatian belum siap pada database lokal.", detail: "Terapkan migrasi D1 lokal 0006_store_alerts.sql dengan perintah npm run d1:migrate:local, lalu muat ulang halaman." }, 503);
      }
      return json({ error: "Pusat Perhatian gagal memuat notifikasi.", detail }, 503);
    }
  }
  const match = pathname.match(/^\/api\/store-alerts\/([\w-]+)$/);
  if (!match || request.method !== "PATCH") return json({ error: "Endpoint notifikasi tidak ditemukan." }, 404);
  const body = await parseJsonBody(request) || {};
  const status = body.status;
  if (!["dibaca", "ditangani", "selesai", "tidak_relevan"].includes(status)) return json({ error: "Status notifikasi tidak valid." }, 400);
  const result = await env.DB.prepare(`UPDATE store_alerts SET status=?,read_at=CASE WHEN ? IN ('dibaca','ditangani','selesai') THEN COALESCE(read_at,CURRENT_TIMESTAMP) ELSE read_at END,
    resolved_at=CASE WHEN ? IN ('selesai','tidak_relevan') THEN CURRENT_TIMESTAMP ELSE NULL END,updated_at=CURRENT_TIMESTAMP
    WHERE business_id=? AND id=?`).bind(status, status, status, businessId, decodeURIComponent(match[1])).run();
  if (!result.meta.changes) return json({ error: "Notifikasi tidak ditemukan." }, 404);
  return json({ success: true });
}

export default {
  async fetch(request, env, context) {
    const url = new URL(request.url);
    try {
      // Route Pages meneruskan request ke sini; permintaan non-API dilayani sebagai aset statis.
      if (url.pathname.startsWith("/api/auth/")) {
        return await authApi(request, env, url.pathname);
      }
      if (url.pathname.startsWith("/api/")) {
        const requestOrigin = request.headers.get("Origin");
        if (request.method !== "GET" && requestOrigin && requestOrigin !== url.origin) {
          return json({ error: "Permintaan lintas situs ditolak." }, 403);
        }
        if (!sessionSecretConfigured(env)) {
          return json({ error: AUTH_SETUP_MESSAGE }, 503);
        }
        await getOrCreateLegacyUser(env);
        const user = await getSessionUser(request, env);
        if (!user) {
          return json({ error: "Sesi login tidak valid. Silakan masuk kembali." }, 401);
        }
        if (url.pathname === "/api/admin/accounts") {
          if (!isAdminUser(user, env)) return json({ error: "Akses admin tidak diizinkan." }, 403);
          return await adminAccountsApi(request, env, user);
        }
        if (url.pathname === "/api/admin/data") {
          if (!isAdminUser(user, env)) return json({ error: "Akses admin tidak diizinkan." }, 403);
          return await adminDataApi(request, env);
        }
        if (url.pathname === "/api/products" || url.pathname.startsWith("/api/products/")) {
          return await productsApi(request, env, url.pathname, user.business_id);
        }
        if (url.pathname === "/api/payment-settings") {
          return await paymentSettingsApi(request, env, user.business_id);
        }
        if (url.pathname === "/api/transactions") {
          return await transactionsApi(request, env, user.business_id);
        }
        if (url.pathname === "/api/store-alerts" || url.pathname.startsWith("/api/store-alerts/")) {
          return await storeAlertsApi(request, env, user.business_id, url.pathname);
        }
        if (url.pathname === "/api/smart-insight" && request.method === "POST") {
          return await smartInsightApi(request, env, user.business_id);
        }
        return json({ error: "Endpoint API tidak ditemukan" }, 404);
      }
      return await env.ASSETS.fetch(request);
    } catch (error) {
      console.error("[KASIR BISA BACKEND ERROR]", {
        path: url.pathname,
        method: request.method,
        message: error?.message || String(error),
        stack: error?.stack || null
      });
      return json({ error: "Permintaan gagal diproses", detail: error?.message || "Kesalahan internal backend." }, 500);
    }
  },
};
