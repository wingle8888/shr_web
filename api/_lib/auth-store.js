const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { hasBlob, isHosted, blobGetJson, blobPutJson, blobStoreId, blobToken } = require("./blob-store");
const { formatRegisterPlace } = require("./geo");

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

async function readUsersFromBlob() {
  if (!hasBlob()) return null;
  try {
    const db = await blobGetJson(BLOB_LIST);
    if (Array.isArray(db)) return db;
    if (db && Array.isArray(db.users)) return db.users;
    return null;
  } catch (_) {
    return null;
  }
}

async function writeUsersToBlob(users) {
  if (!hasBlob()) return false;
  const list = Array.isArray(users) ? users : [];
  const ok = await blobPutJson(BLOB_LIST, list);
  if (!ok) return false;
  for (const user of list) {
    if (!user || !user.email) continue;
    await blobPutJson(`${BLOB_DIR}/${emailKey(user.email)}.json`, user);
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
 * 写入用户库。线上必须写入 R2 / Blob 才算成功。
 */
async function writeUsers(users) {
  const list = Array.isArray(users) ? users : [];
  writeUsersLocal(list);

  if (hasBlob()) {
    try {
      const ok = await writeUsersToBlob(list);
      if (!ok) {
        const err = new Error("数据未能保存到服务器，请重试");
        err.code = "BLOB_WRITE_FAILED";
        throw err;
      }
      return { users: list, persisted: true, storage: "blob" };
    } catch (e) {
      const err = new Error(String((e && e.message) || e || "数据未能保存到服务器，请重试"));
      err.code = "BLOB_WRITE_FAILED";
      throw err;
    }
  }

  if (isHosted()) {
    const err = new Error("数据未能保存到服务器，请重试");
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
      registerPlace: u.registerPlace || prev.registerPlace || null,
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

function findStoredUser(users, hint) {
  const list = Array.isArray(users) ? users : [];
  const id = String((hint && hint.id) || "").trim();
  const email = String((hint && hint.email) || "").trim().toLowerCase();
  return (
    list.find((u) => {
      if (!u) return false;
      if (id && String(u.id || "") === id) return true;
      if (email && String(u.email || "").trim().toLowerCase() === email) return true;
      return false;
    }) || null
  );
}

async function resolveUserFromToken(token) {
  const data = verifyToken(token);
  if (!data) return null;
  const user = findStoredUser(await readUsers(), data);
  return user || null;
}

function normalizeUserIds(ids) {
  const list = Array.isArray(ids) ? ids : ids != null ? [ids] : [];
  const out = [];
  list.forEach((id) => {
    const s = String(id || "").trim();
    if (!s) return;
    out.push(s);
    const lower = s.toLowerCase();
    if (lower !== s) out.push(lower);
  });
  return [...new Set(out)];
}

function userMatchesId(user, ids) {
  const set = ids instanceof Set ? ids : new Set(normalizeUserIds(ids));
  if (!user) return false;
  const id = String(user.id || "").trim();
  const email = String(user.email || "").trim().toLowerCase();
  return (id && set.has(id)) || (email && set.has(email));
}

async function deleteUsers(ids) {
  const remove = new Set(normalizeUserIds(ids));
  const current = await readUsers();
  if (!remove.size) return { users: current, persisted: true, storage: storageStatus().storage };
  return writeUsers(current.filter((user) => !userMatchesId(user, remove)));
}

async function clearUsers() {
  return writeUsers([]);
}

function publicUser(u) {
  const place = u && u.registerPlace && typeof u.registerPlace === "object" ? u.registerPlace : null;
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    phone: u.phone || "",
    createdAt: u.createdAt,
    source: u.source || "server",
    registerPlace: place,
    registerPlaceLabel: (place && place.label) || formatRegisterPlace(place) || "",
  };
}

function storageStatus() {
  if (hasBlob()) {
    return {
      ok: true,
      storage: "blob",
      message: "服务器已保存数据，电脑和手机看到的是同一份",
      storeId: blobStoreId() || null,
      hasToken: Boolean(blobToken()),
    };
  }
  if (isHosted()) {
    return {
      ok: false,
      storage: "none",
      message: "服务器存储未就绪，后台改动无法保存",
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
  isVercel: isHosted,
  isHosted,
  storageStatus,
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  resolveUserFromToken,
  findStoredUser,
  publicUser,
  deleteUsers,
  clearUsers,
  userMatchesId,
  normalizeUserIds,
};
