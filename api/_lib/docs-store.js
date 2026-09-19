const fs = require("fs");
const path = require("path");
const { readJsonStore, writeJsonStore } = require("./blob-store");

const ROOT = process.cwd();
const MANIFEST_PATH = path.join(ROOT, "data", "downloads-manifest.json");
const TMP_MANIFEST = path.join("/tmp", "shr-downloads-manifest.json");
const UPLOAD_DIR = path.join(ROOT, "downloads", "uploads");
const BLOB_PATH = "shr-admin/downloads-manifest.json";

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

function mergeManifest(a, b) {
  const left = a && typeof a === "object" && !Array.isArray(a) ? a : {};
  const right = b && typeof b === "object" && !Array.isArray(b) ? b : {};
  const out = { ...left };
  Object.keys(right).forEach((pid) => {
    const map = new Map();
    [...(Array.isArray(out[pid]) ? out[pid] : []), ...(Array.isArray(right[pid]) ? right[pid] : [])].forEach((f) => {
      if (f && f.id) map.set(String(f.id), f);
    });
    out[pid] = Array.from(map.values());
  });
  return out;
}

function readSeedManifest() {
  try {
    return require("../../data/downloads-manifest.json");
  } catch {
    try {
      return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
    } catch {
      return {};
    }
  }
}

async function readManifest() {
  const data = await readJsonStore({
    blobPath: BLOB_PATH,
    localPaths: [TMP_MANIFEST, MANIFEST_PATH],
    empty: readSeedManifest(),
    merge: mergeManifest,
  });
  return data && typeof data === "object" ? data : {};
}

async function writeManifest(data) {
  const payload = mergeManifest({}, data);
  await writeJsonStore({
    blobPath: BLOB_PATH,
    localPaths: [TMP_MANIFEST, MANIFEST_PATH],
    data: payload,
  });
  return payload;
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
