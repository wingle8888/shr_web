const fs = require("fs");
const path = require("path");
const {
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
} = require("../_lib/docs-store");

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { ok: false, error: "method not allowed" });
    return;
  }

  const body = parseBody(req);
  req.body = body;

  if (!checkAdmin(req)) {
    sendJson(res, 401, { ok: false, error: "unauthorized" });
    return;
  }

  const productId = String(body.productId || "").trim();
  const fileName = safeFileName(body.fileName || "docs.zip");
  const displayName = String(body.displayName || fileName).trim();
  const displayNameEn = String(body.displayNameEn || displayName).trim();
  const contentBase64 = body.contentBase64 || "";

  if (!productId || !contentBase64) {
    sendJson(res, 400, { ok: false, error: "productId and contentBase64 required" });
    return;
  }

  const ext = extOf(fileName);
  if (!ALLOWED_EXT.includes(ext)) {
    sendJson(res, 400, { ok: false, error: "only zip/rar/7z allowed" });
    return;
  }

  let buffer;
  try {
    buffer = Buffer.from(contentBase64, "base64");
  } catch {
    sendJson(res, 400, { ok: false, error: "invalid base64" });
    return;
  }

  if (buffer.length > 4.2 * 1024 * 1024) {
    sendJson(res, 400, { ok: false, error: "file too large (max ~4MB on this API)" });
    return;
  }

  const id = `up-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const storedName = `${productId}_${id}${ext}`;
  let fileUrl = "";

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { put } = require("@vercel/blob");
      const blob = await put(`product-docs/${storedName}`, buffer, {
        access: "public",
        token: process.env.BLOB_READ_WRITE_TOKEN,
        contentType: "application/octet-stream",
      });
      fileUrl = blob.url;
    } catch (err) {
      sendJson(res, 500, { ok: false, error: "blob upload failed", detail: String(err.message || err) });
      return;
    }
  } else {
    try {
      ensureUploadDir();
      const abs = path.join(UPLOAD_DIR, storedName);
      fs.writeFileSync(abs, buffer);
      fileUrl = `/downloads/uploads/${storedName}`;
    } catch (err) {
      sendJson(res, 500, {
        ok: false,
        error:
          "cannot write upload (set BLOB_READ_WRITE_TOKEN on Vercel for persistent cloud storage)",
        detail: String(err.message || err),
      });
      return;
    }
  }

  const item = {
    id,
    name: displayName,
    nameEn: displayNameEn,
    file: fileUrl,
    format: formatFromExt(ext),
    size: buffer.length,
    uploadedAt: new Date().toISOString(),
  };

  const manifest = readManifest();
  if (!Array.isArray(manifest[productId])) manifest[productId] = [];
  manifest[productId].unshift(item);
  writeManifest(manifest);

  sendJson(res, 200, { ok: true, item, note: process.env.BLOB_READ_WRITE_TOKEN ? "blob" : "local" });
};
