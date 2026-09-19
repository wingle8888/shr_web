const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const USERS_FILE = path.join(process.cwd(), "data", "users.json");
const TMP_USERS = path.join("/tmp", "shr-users.json");
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

function hasBlob() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function emailKey(email) {
  return String(email || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9@._+-]/g, "_")
    .slice(0, 120);
}

async function readUsersFromBlob() {
  if (!hasBlob()) return null;
  try {
    const { list } = require("@vercel/blob");
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    const { blobs } = await list({ prefix: `${BLOB_DIR}/`, token });
    if (!blobs || blobs.length === 0) {
      // 兼容旧的单文件
      const legacy = await list({ prefix: "shr-auth/users", token });
      const file = (legacy.blobs || []).find((b) => String(b.pathname).includes("users"));
      if (!file) return [];
      const res = await fetch(file.url);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }
    const users = [];
    for (const blob of blobs) {
      try {
        const res = await fetch(blob.url);
        if (!res.ok) continue;
        const data = await res.json();
        if (data && data.email) users.push(data);
      } catch (_) {}
    }
    return users;
  } catch (_) {
    return null;
  }
}

async function writeUsersToBlob(users) {
  if (!hasBlob()) return false;
  try {
    const { put } = require("@vercel/blob");
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    const list = Array.isArray(users) ? users : [];
    for (const user of list) {
      if (!user || !user.email) continue;
      const pathname = `${BLOB_DIR}/${emailKey(user.email)}.json`;
      const opts = {
        access: "public",
        addRandomSuffix: false,
        contentType: "application/json",
        token,
        allowOverwrite: true,
      };
      try {
        await put(pathname, JSON.stringify(user), opts);
      } catch (_) {
        await put(pathname, JSON.stringify(user), {
          access: "public",
          addRandomSuffix: false,
          contentType: "application/json",
          token,
        });
      }
    }
    return true;
  } catch (_) {
    return false;
  }
}

async function readUsers() {
  const fromBlob = await readUsersFromBlob();
  if (Array.isArray(fromBlob)) {
    if (fromBlob.length > 0) return fromBlob;
    const local = readUsersLocal();
    if (local.length) return local;
    return fromBlob;
  }
  return readUsersLocal();
}

async function writeUsers(users) {
  const list = Array.isArray(users) ? users : [];
  writeUsersLocal(list);
  const ok = await writeUsersToBlob(list);
  return { users: list, persisted: ok || !process.env.VERCEL };
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

module.exports = {
  cors,
  sendJson,
  parseBody,
  readUsers,
  writeUsers,
  mergeUsers,
  hasBlob,
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  publicUser,
};
