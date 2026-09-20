const {
  cors,
  sendJson,
  checkAdmin,
  readManifest,
  writeManifest,
  parseBody,
} = require("../_lib/docs-store");

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method === "GET") {
    if (!(await checkAdmin(req))) {
      sendJson(res, 401, { ok: false, error: "unauthorized" });
      return;
    }
    sendJson(res, 200, { ok: true, downloads: await readManifest() });
    return;
  }

  if (req.method === "DELETE" || req.method === "POST") {
    const body = parseBody(req);
    req.body = body;
    if (!(await checkAdmin(req))) {
      sendJson(res, 401, { ok: false, error: "unauthorized" });
      return;
    }
    // POST with action=delete for clients that cannot DELETE easily
    if (req.method === "POST" && body.action !== "delete") {
      sendJson(res, 400, { ok: false, error: "use action=delete" });
      return;
    }

    const productId = String(body.productId || "").trim();
    const fileId = String(body.fileId || "").trim();
    if (!productId || !fileId) {
      sendJson(res, 400, { ok: false, error: "productId and fileId required" });
      return;
    }

    const manifest = await readManifest();
    const list = Array.isArray(manifest[productId]) ? manifest[productId] : [];
    const next = list.filter((x) => x.id !== fileId);
    if (next.length === list.length) {
      sendJson(res, 404, { ok: false, error: "file not found" });
      return;
    }
    manifest[productId] = next;
    await writeManifest(manifest);
    sendJson(res, 200, { ok: true });
    return;
  }

  sendJson(res, 405, { ok: false, error: "method not allowed" });
};
