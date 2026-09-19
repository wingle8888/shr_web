const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const USERS_FILE = path.join(process.cwd(), "data", "users.json");
const TMP_USERS = path.join("/tmp", "shr-users.json");

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
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

function readUsers() {
  try {
    if (fs.existsSync(TMP_USERS)) return JSON.parse(fs.readFileSync(TMP_USERS, "utf8"));
  } catch (_) {}
  try {
    if (fs.existsSync(USERS_FILE)) return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
  } catch (_) {}
  return [];
}

function writeUsers(users) {
  const text = JSON.stringify(users, null, 2);
  try {
    fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
    fs.writeFileSync(USERS_FILE, text);
  } catch (_) {}
  try {
    fs.writeFileSync(TMP_USERS, text);
  } catch (_) {}
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
  return { id: u.id, email: u.email, name: u.name, phone: u.phone || "", createdAt: u.createdAt };
}

module.exports = {
  cors,
  sendJson,
  parseBody,
  readUsers,
  writeUsers,
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  publicUser,
};
