const fs = require("fs");
const path = require("path");

const mem = new Map();

function blobToken() {
  return String(process.env.BLOB_READ_WRITE_TOKEN || "").trim();
}

function blobStoreId() {
  return String(process.env.BLOB_STORE_ID || "").trim();
}

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

async function streamToText(stream) {
  if (!stream) return "";
  if (typeof stream === "string") return stream;
  if (Buffer.isBuffer(stream)) return stream.toString("utf8");
  if (typeof stream.text === "function") return stream.text();
  return new Response(stream).text();
}

async function blobGetJson(pathname) {
  if (!hasBlob()) return null;
  try {
    const { get } = require("@vercel/blob");
    const result = await get(pathname, { access: "private", ...blobAuthOpts() });
    if (!result || result.statusCode !== 200) return null;
    const text = await streamToText(result.stream);
    if (!text) return null;
    return JSON.parse(text);
  } catch (_) {
    return null;
  }
}

async function blobPutJson(pathname, body) {
  if (!hasBlob()) return false;
  const { put } = require("@vercel/blob");
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  await put(pathname, payload, {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    ...blobAuthOpts(),
  });
  return true;
}

async function blobPutFile(pathname, buffer, contentType) {
  if (!hasBlob()) return null;
  const { put } = require("@vercel/blob");
  return put(pathname, buffer, {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: contentType || "application/octet-stream",
    ...blobAuthOpts(),
  });
}

async function streamToBuffer(stream) {
  if (!stream) return Buffer.alloc(0);
  if (Buffer.isBuffer(stream)) return stream;
  if (typeof stream === "string") return Buffer.from(stream);
  const ab = await new Response(stream).arrayBuffer();
  return Buffer.from(ab);
}

async function blobGetFile(pathname) {
  if (!hasBlob()) return null;
  try {
    const { get } = require("@vercel/blob");
    const result = await get(pathname, { access: "private", ...blobAuthOpts() });
    if (!result || result.statusCode !== 200) return null;
    return {
      buffer: await streamToBuffer(result.stream),
      contentType: (result.blob && result.blob.contentType) || "application/octet-stream",
    };
  } catch (_) {
    return null;
  }
}

/**
 * 读 JSON：内存 → 本地/tmp → Blob，并用 merge 合并。
 */
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
  } else if (isVercel()) {
    const err = new Error("BLOB_STORE_ID / BLOB_READ_WRITE_TOKEN not configured");
    err.code = "BLOB_MISSING";
    throw err;
  }
  return data;
}

module.exports = {
  hasBlob,
  isVercel,
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
