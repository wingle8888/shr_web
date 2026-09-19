const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const USERS_FILE = path.join(process.cwd(), "data", "users.json");
const TMP_USERS = path.join("/tmp", "shr-users.json");
const BLOB_LIST = "shr-auth/users-db.json";
const BLOB_DIR = "shr-auth/u";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-admin-password");
}

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return {};
}

function blobToken() {
  return String(process.env.BLOB_READ_WRITE_TOKEN || "").trim();
}

function blobStoreId() {
  return String(process.env.BLOB_STORE_ID || "").trim();
}

/**
 * Vercel 新版 Blob：线上可用 OIDC + BLOB_STORE_ID；
 * 也兼容长期 BLOB_READ_WRITE_TOKEN。
 */
function hasBlob() {
  if (blobToken()) return true;
  if (blobStoreId() && (process.env.VERCEL || process.env.VERCEL_OIDC_TOKEN)) return true;
  return false;
}

function isVercel() {
  return Boolean(process.env.VERCEL);
}

function blobAuthOpts() {
  const token = blobToken();
  return token ? { token } : {};
}

function emailKey(email) {
  return String(email || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9@._+-]/g, "_")
    .slice(0, 120);
}

function readUsersLocal() {
  try {
    if (fs.existsSync(TMP_USERS)) return JSON.parse(fs.readFileSync(TMP_USERS, "utf8"));
  } catch (_) {}
  try {
    if (fs.existsSync(USERS_FILE)) return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
  } catch (_) {}
  return [];
}

function writeUsersLocal(users) {
  const text = JSON.stringify(users, null, 2);
  try {
    fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
    fs.writeFileSync(USERS_FILE, text);
  } catch (_) {}
  try {
    fs.writeFileSync(TMP_USERS, text);
  } catch (_) {}
}

async function streamToText(stream) {
  if (!stream) return "";
  if (typeof stream === "string") return stream;
  if (Buffer.isBuffer(stream)) return stream.toString("utf8");
  if (typeof stream.text === "function") return stream.text();
  return new Response(stream).text();
}

async function blobGetJson(pathname) {
  const { get } = require("@vercel/blob");
  try {
    const result = await get(pathname, { access: "private", ...blobAuthOpts() });
    if (!result || result.statusCode !== 200) return null;
    const text = await streamToText(result.stream);
    if (!text) return null;
    return JSON.parse(text);
  } catch (_) {
    return null;
  }
}

async function blobFetchJson(url) {
  const token = blobToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(url, { headers });
  if (!res.ok) return null;
  try {
    return await res.json();
  } catch (_) {
    return null;
  }
}

async function blobPut(pathname, body) {
  const { put } = require("@vercel/blob");
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  // Private Blob Store 必须用 access: "private"（需 @vercel/blob >= 2.3）
  return put(pathname, payload, {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    ...blobAuthOpts(),
  });
}

async function readUsersFromBlob() {
  if (!hasBlob()) return null;
  try {
    // 1) 直接按路径读取总库（Private Store 推荐）
    const db = await blobGetJson(BLOB_LIST);
    if (Array.isArray(db)) return db;
    if (db && Array.isArray(db.users)) return db.users;

    // 2) list 兼容旧路径 / 逐用户文件
    const { list } = require("@vercel/blob");
    const listed = await list({ prefix: "shr-auth/", ...blobAuthOpts() });
    const dbFile = (listed.blobs || []).find((b) => String(b.pathname).endsWith("users-db.json"));
    if (dbFile) {
      const byPath = await blobGetJson(dbFile.pathname);
      if (Array.isArray(byPath)) return byPath;
      if (byPath && Array.isArray(byPath.users)) return byPath.users;
      if (dbFile.url) {
        const data = await blobFetchJson(dbFile.url);
        if (Array.isArray(data)) return data;
        if (data && Array.isArray(data.users)) return data.users;
      }
    }

    const users = [];
    for (const blob of listed.blobs || []) {
      if (!String(blob.pathname).startsWith(`${BLOB_DIR}/`)) continue;
      try {
        const row = (await blobGetJson(blob.pathname)) || (blob.url ? await blobFetchJson(blob.url) : null);
        if (row && row.email) users.push(row);
      } catch (_) {}
    }
    return users;
  } catch (_) {
    return null;
  }
}

async function writeUsersToBlob(users) {
  if (!hasBlob()) return false;
  const list = Array.isArray(users) ? users : [];
  await blobPut(BLOB_LIST, list);
  for (const user of list) {
    if (!user || !user.email) continue;
    await blobPut(`${BLOB_DIR}/${emailKey(user.email)}.json`, user);
  }
  return true;
}

async function readUsers() {
  if (hasBlob()) {
    const fromBlob = await readUsersFromBlob();
    if (Array.isArray(fromBlob)) return fromBlob;
  }
  return readUsersLocal();
}

/**
 * 写入用户库。线上(Vercel)必须写入 Blob 才算成功。
 */
async function writeUsers(users) {
  const list = Array.isArray(users) ? users : [];
  writeUsersLocal(list);

  if (hasBlob()) {
    try {
      await writeUsersToBlob(list);
      return { users: list, persisted: true, storage: "blob" };
    } catch (e) {
      const err = new Error(String((e && e.message) || e || "cloud storage write failed"));
      err.code = "BLOB_WRITE_FAILED";
      throw err;
    }
  }

  if (isVercel()) {
    const err = new Error("BLOB_STORE_ID / BLOB_READ_WRITE_TOKEN not configured");
    err.code = "BLOB_MISSING";
    throw err;
  }

  return { users: list, persisted: true, storage: "local" };
}

function mergeUsers(base, incoming) {
  const map = new Map();
  (base || []).forEach((u) => {
    if (u && u.email) map.set(String(u.email).toLowerCase(), u);
  });
  (incoming || []).forEach((u) => {
    if (!u || !u.email) return;
    const key = String(u.email).toLowerCase();
    const prev = map.get(key);
    if (!prev) {
      map.set(key, u);
      return;
    }
    map.set(key, {
      ...prev,
      ...u,
      salt: u.salt || prev.salt,
      hash: u.hash || prev.hash,
      localHash: u.localHash != null ? u.localHash : prev.localHash,
      createdAt: prev.createdAt || u.createdAt,
    });
  });
  return Array.from(map.values()).sort((a, b) =>
    String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
  );
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return { salt, hash };
}

function verifyPassword(password, salt, hash) {
  const next = crypto.scryptSync(String(password), salt, 64).toString("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(next, "hex"), Buffer.from(hash, "hex"));
  } catch {
    return false;
  }
}

function authSecret() {
  return process.env.AUTH_SECRET || process.env.ADMIN_PASSWORD || "shr-auth-secret-2026";
}

function signToken(user) {
  const exp = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({ id: user.id, email: user.email, name: user.name, exp })).toString(
    "base64url"
  );
  const sig = crypto.createHmac("sha256", authSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function verifyToken(token) {
  if (!token || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  const expect = crypto.createHmac("sha256", authSecret()).update(payload).digest("base64url");
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  } catch {
    return null;
  }
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data.exp || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

function publicUser(u) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    phone: u.phone || "",
    createdAt: u.createdAt,
    source: u.source || "server",
  };
}

function storageStatus() {
  if (hasBlob()) {
    return {
      ok: true,
      storage: "blob",
      message: "服务器云存储已启用，注册资料可跨设备查看",
      storeId: blobStoreId() || null,
      hasToken: Boolean(blobToken()),
    };
  }
  if (isVercel()) {
    return {
      ok: false,
      storage: "none",
      message:
        "未检测到 Blob：请确认 Storage 已关联本项目，且 Production 含 BLOB_STORE_ID / BLOB_READ_WRITE_TOKEN，并重新部署。",
      storeId: blobStoreId() || null,
      hasToken: Boolean(blobToken()),
    };
  }
  return { ok: true, storage: "local", message: "本地开发模式" };
}

module.exports = {
  cors,
  sendJson,
  parseBody,
  readUsers,
  writeUsers,
  mergeUsers,
  hasBlob,
  isVercel,
  storageStatus,
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  publicUser,
};
