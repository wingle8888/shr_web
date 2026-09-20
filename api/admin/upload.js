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
const { hasBlob, blobPutFile, isHosted } = require("../_lib/blob-store");

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

  if (!(await checkAdmin(req))) {
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

  const blobReady = hasBlob();
  if (blobReady) {
    try {
      const blob = await blobPutFile(`product-docs/${storedName}`, buffer, "application/octet-stream");
      if (!blob) {
        sendJson(res, 503, { ok: false, error: "数据未能保存到服务器，请重试" });
        return;
      }
      fileUrl = blob.url ? blob.url : `/api/downloads?file=${encodeURIComponent(`product-docs/${storedName}`)}`;
    } catch (err) {
      sendJson(res, 500, { ok: false, error: "数据未能保存到服务器，请重试", detail: String(err.message || err) });
      return;
    }
  } else if (isHosted()) {
    sendJson(res, 503, {
      ok: false,
      error: "数据未能保存到服务器，请重试",
    });
    return;
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
          "cannot write upload (bind Cloudflare R2 bucket SHR_BUCKET for persistent storage)",
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

  const manifest = await readManifest();
  if (!Array.isArray(manifest[productId])) manifest[productId] = [];
  manifest[productId].unshift(item);
  await writeManifest(manifest);

  sendJson(res, 200, { ok: true, item, note: blobReady ? "blob" : "local" });
};
