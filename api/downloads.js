const {
  cors,
  sendJson,
  readManifest,
} = require("./_lib/docs-store");
const { blobGetFile } = require("./_lib/blob-store");

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "GET") {
    sendJson(res, 405, { ok: false, error: "method not allowed" });
    return;
  }

  const url = new URL(req.url, "http://localhost");
  const fileKey = String(url.searchParams.get("file") || "").trim();
  if (fileKey) {
    if (!/^(product-docs|shr-admin)\//.test(fileKey) || fileKey.includes("..")) {
      sendJson(res, 403, { ok: false, error: "forbidden" });
      return;
    }
    const file = await blobGetFile(fileKey);
    if (!file) {
      res.statusCode = 404;
      res.end();
      return;
    }
    res.statusCode = 200;
    res.setHeader("Content-Type", file.contentType || "application/octet-stream");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.end(file.buffer);
    return;
  }

  const productId = String(url.searchParams.get("productId") || "").trim();
  const manifest = await readManifest();

  if (!productId) {
    sendJson(res, 200, { ok: true, downloads: manifest });
    return;
  }

  const list = Array.isArray(manifest[productId]) ? manifest[productId] : [];
  sendJson(res, 200, { ok: true, productId, downloads: list });
};
