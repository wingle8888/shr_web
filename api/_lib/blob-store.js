const fs = require("fs");
const path = require("path");
const { getR2, disableR2, isCloudflare } = require("./runtime-env");

const mem = new Map();
const STORE_HOST = "https://develop-boards.com";

function blobToken() {
  return String(process.env.BLOB_READ_WRITE_TOKEN || "").trim();
}

function blobStoreId() {
  return String(process.env.BLOB_STORE_ID || "").trim();
}

function isVercel() {
  return Boolean(process.env.VERCEL);
}

function isHosted() {
  return isVercel() || isCloudflare();
}

function getCachesObj() {
  try {
    if (typeof caches !== "undefined" && caches) return caches;
  } catch (_) {}
  try {
    if (globalThis.caches) return globalThis.caches;
  } catch (_) {}
  return null;
}

function canUseCache() {
  return Boolean(getCachesObj());
}

function storageKind() {
  if (canUseCache()) return "cache";
  if (getR2()) return "r2";
  return "";
}

function hasBlob() {
  return Boolean(storageKind());
}

function blobAuthOpts() {
  const token = blobToken();
  return token ? { token } : {};
}

function readLocalJson(filePath, fallback) {
  try {
    if (filePath && fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (_) {}
  return fallback;
}

function writeLocalJson(filePath, data) {
  if (!filePath) return;
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data));
  } catch (_) {}
}

function storeRequest(pathname) {
  return new Request(`${STORE_HOST}/__shr-store/${encodeURIComponent(pathname)}`, { method: "GET" });
}

async function openStoreCache() {
  const c = getCachesObj();
  if (!c) return null;
  try {
    if (c.default && typeof c.default.match === "function") return c.default;
  } catch (_) {}
  try {
    if (typeof c.open === "function") return await c.open("shr-admin");
  } catch (_) {}
  return null;
}

async function cacheGetJson(pathname) {
  try {
    const cache = await openStoreCache();
    if (!cache) return null;
    const res = await cache.match(storeRequest(pathname));
    if (!res) return null;
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  } catch (_) {
    return null;
  }
}

async function cachePutJson(pathname, payload) {
  try {
    const cache = await openStoreCache();
    if (!cache || typeof cache.put !== "function") return false;
    await cache.put(
      storeRequest(pathname),
      new Response(payload, {
        status: 200,
        headers: {
          "content-type": "application/json",
          "cache-control": "public, max-age=31536000",
        },
      })
    );
    return true;
  } catch (_) {
    return false;
  }
}

async function parseStoredJson(obj) {
  if (obj == null) return null;
  if (typeof obj === "string") return obj ? JSON.parse(obj) : null;
  if (typeof obj.text === "function") {
    const text = await obj.text();
    return text ? JSON.parse(text) : null;
  }
  if (typeof obj.json === "function") return obj.json();
  if (typeof obj === "object") return obj;
  return null;
}

async function blobGetJson(pathname) {
  const cached = await cacheGetJson(pathname);
  if (cached != null) return cached;
  const r2 = getR2();
  if (!r2) return null;
  try {
    return await parseStoredJson(await r2.get(pathname));
  } catch (_) {
    disableR2();
    return null;
  }
}

async function blobPutJson(pathname, body) {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  return cachePutJson(pathname, payload);
}

async function blobPutFile() {
  return null;
}

async function blobGetFile(pathname) {
  const r2 = getR2();
  if (!r2) return null;
  try {
    const obj = await r2.get(pathname);
    if (!obj) return null;
    return {
      buffer: Buffer.from(await obj.arrayBuffer()),
      contentType: (obj.httpMetadata && obj.httpMetadata.contentType) || "application/octet-stream",
    };
  } catch (_) {
    disableR2();
    return null;
  }
}

async function readJsonStore({ blobPath, localPaths = [], empty, merge }) {
  let data = mem.has(blobPath) ? mem.get(blobPath) : empty;
  (localPaths || []).forEach((p) => {
    const local = readLocalJson(p, null);
    if (local == null) return;
    data = typeof merge === "function" ? merge(data, local) : local;
  });
  const fromBlob = await blobGetJson(blobPath);
  if (fromBlob != null) {
    data = typeof merge === "function" ? merge(data, fromBlob) : fromBlob;
  }
  mem.set(blobPath, data);
  return data;
}

async function writeJsonStore({ blobPath, localPaths = [], data }) {
  mem.set(blobPath, data);
  (localPaths || []).forEach((p) => writeLocalJson(p, data));
  const saved = await blobPutJson(blobPath, data);
  if (!saved && isHosted()) {
    const err = new Error("下架名单未能写入云端，请稍后重试");
    err.code = "BLOB_MISSING";
    throw err;
  }
  return data;
}

module.exports = {
  hasBlob,
  storageKind,
  isVercel,
  isHosted,
  isCloudflare,
  blobToken,
  blobStoreId,
  blobAuthOpts,
  blobGetJson,
  blobPutJson,
  blobPutFile,
  blobGetFile,
  readJsonStore,
  writeJsonStore,
};
