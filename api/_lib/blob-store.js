const fs = require("fs");
const path = require("path");
const { getR2, getKV, isCloudflare } = require("./runtime-env");

const mem = new Map();
const CACHE_ORIGIN = "https://shr-store.internal/";

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

function canUseCache() {
  try {
    return typeof caches !== "undefined" && caches.default && typeof caches.default.match === "function";
  } catch (_) {
    return false;
  }
}

function storageKind() {
  if (getR2()) return "r2";
  if (getKV()) return "kv";
  if (canUseCache()) return "cache";
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

async function cacheGetJson(pathname) {
  if (!canUseCache()) return null;
  try {
    const res = await caches.default.match(new Request(CACHE_ORIGIN + pathname));
    if (!res) return null;
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  } catch (_) {
    return null;
  }
}

async function cachePutJson(pathname, body) {
  if (!canUseCache()) return false;
  try {
    const payload = typeof body === "string" ? body : JSON.stringify(body);
    await caches.default.put(
      new Request(CACHE_ORIGIN + pathname),
      new Response(payload, {
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
  const r2 = getR2();
  if (r2) {
    try {
      const parsed = await parseStoredJson(await r2.get(pathname));
      if (parsed != null) return parsed;
    } catch (_) {}
  }
  const kv = getKV();
  if (kv) {
    try {
      const parsed = await parseStoredJson(await kv.get(pathname, { type: "json" }));
      if (parsed != null) return parsed;
    } catch (_) {
      try {
        const parsed = await parseStoredJson(await kv.get(pathname));
        if (parsed != null) return parsed;
      } catch (_) {}
    }
  }
  return cacheGetJson(pathname);
}

async function blobPutJson(pathname, body) {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  let ok = false;
  const r2 = getR2();
  if (r2) {
    await r2.put(pathname, payload, { httpMetadata: { contentType: "application/json" } });
    ok = true;
  }
  const kv = getKV();
  if (kv) {
    await kv.put(pathname, payload);
    ok = true;
  }
  if (await cachePutJson(pathname, payload)) ok = true;
  return ok;
}

async function blobPutFile(pathname, buffer, contentType) {
  const r2 = getR2();
  if (!r2) return null;
  const type = contentType || "application/octet-stream";
  const body = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  await r2.put(pathname, body, { httpMetadata: { contentType: type } });
  return { url: `/api/downloads?file=${encodeURIComponent(pathname)}` };
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
  if (hasBlob()) {
    const saved = await blobPutJson(blobPath, data);
    if (!saved && isHosted()) {
      const err = new Error("Cloudflare R2 / 存储写入失败");
      err.code = "BLOB_MISSING";
      throw err;
    }
  } else if (isHosted()) {
    const err = new Error("Cloudflare R2 未绑定，下架/删除无法保存到商城");
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
