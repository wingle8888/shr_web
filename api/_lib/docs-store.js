const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const MANIFEST_PATH = path.join(ROOT, "data", "downloads-manifest.json");
const TMP_MANIFEST = path.join("/tmp", "shr-downloads-manifest.json");
const UPLOAD_DIR = path.join(ROOT, "downloads", "uploads");

const ALLOWED_EXT = [".zip", ".rar", ".7z"];

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-password");
}

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

function checkAdmin(req) {
  const expected = process.env.ADMIN_PASSWORD || "shr-admin-2026";
  const fromHeader = req.headers["x-admin-password"];
  let bodyPass = "";
  if (req.body && typeof req.body === "object") bodyPass = req.body.password || "";
  return fromHeader === expected || bodyPass === expected;
}

function readSeedManifest() {
  try {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  } catch {
    return {};
  }
}

function readManifest() {
  try {
    if (fs.existsSync(TMP_MANIFEST)) {
      return JSON.parse(fs.readFileSync(TMP_MANIFEST, "utf8"));
    }
  } catch (_) {}
  return readSeedManifest();
}

function writeManifest(data) {
  const text = JSON.stringify(data, null, 2);
  try {
    fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });
    fs.writeFileSync(MANIFEST_PATH, text);
  } catch (_) {
    /* Vercel 只读文件系统时写到 /tmp */
  }
  try {
    fs.writeFileSync(TMP_MANIFEST, text);
  } catch (_) {}
}

function extOf(name) {
  const m = String(name || "").toLowerCase().match(/(\.[a-z0-9]+)$/);
  return m ? m[1] : "";
}

function formatFromExt(ext) {
  if (ext === ".zip") return "ZIP";
  if (ext === ".rar") return "RAR";
  if (ext === ".7z") return "7Z";
  return ext.replace(".", "").toUpperCase();
}

function safeFileName(name) {
  return String(name || "file")
    .replace(/[^\w.\-()\u4e00-\u9fa5]+/g, "_")
    .slice(0, 120);
}

function ensureUploadDir() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
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

module.exports = {
  cors,
  sendJson,
  checkAdmin,
  readManifest,
  writeManifest,
  ALLOWED_EXT,
  extOf,
  formatFromExt,
  safeFileName,
  ensureUploadDir,
  UPLOAD_DIR,
  parseBody,
};
