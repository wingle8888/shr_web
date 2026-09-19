const {
  cors,
  sendJson,
  readManifest,
  parseBody,
} = require("./_lib/docs-store");

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
  const productId = String(url.searchParams.get("productId") || "").trim();
  const manifest = readManifest();

  if (!productId) {
    sendJson(res, 200, { ok: true, downloads: manifest });
    return;
  }

  const list = Array.isArray(manifest[productId]) ? manifest[productId] : [];
  sendJson(res, 200, { ok: true, productId, downloads: list });
};
