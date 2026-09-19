const fs = require("fs");
const path = require("path");
const { getR2, isCloudflare } = require("./runtime-env");

const mem = new Map();

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

function hasBlob() {
  return Boolean(getR2());
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

async function blobGetJson(pathname) {
  const r2 = getR2();
  if (!r2) return null;
  try {
    const obj = await r2.get(pathname);
    if (!obj) return null;
    const text = await obj.text();
    if (!text) return null;
    return JSON.parse(text);
  } catch (_) {
    return null;
  }
}

async function blobPutJson(pathname, body) {
  const r2 = getR2();
  if (!r2) return false;
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  await r2.put(pathname, payload, { httpMetadata: { contentType: "application/json" } });
  return true;
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
    await blobPutJson(blobPath, data);
  } else if (isHosted()) {
    const err = new Error("Cloudflare R2 / Blob storage is not configured");
    err.code = "BLOB_MISSING";
    throw err;
  }
  return data;
}

module.exports = {
  hasBlob,
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
