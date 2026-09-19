const { cors, sendJson, parseBody } = require("./_lib/docs-store");
const { readCatalog, readProductImage, listVisibleProducts } = require("./_lib/products-store");
const { recordVisit } = require("./_lib/visits-store");

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method === "GET") {
    const url = new URL(req.url, "http://localhost");
    const imgId = String(url.searchParams.get("img") || "").trim();
    if (imgId) {
      const file = await readProductImage(imgId);
      if (!file) {
        res.statusCode = 404;
        res.end();
        return;
      }
      res.statusCode = 200;
      res.setHeader("Content-Type", file.contentType || "image/jpeg");
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.end(file.buffer);
      return;
    }
    const catalog = await readCatalog();
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    sendJson(res, 200, {
      ok: true,
      complete: true,
      products: listVisibleProducts(catalog),
      hiddenIds: catalog.hiddenIds,
      deletedIds: catalog.deletedIds || [],
      galleries: catalog.galleries || {},
    });
    return;
  }

  if (req.method === "POST") {
    const body = parseBody(req);
    if (body.action === "visit" || body.visitorId) {
      const pathName = String(body.path || body.pathName || "").trim();
      if (/^\/admin/i.test(pathName) || /^\/client/i.test(pathName)) {
        sendJson(res, 200, { ok: true, skipped: true });
        return;
      }
      try {
        const result = await recordVisit({
          visitorId: body.visitorId,
          pathName: pathName || "/",
          referrer: body.referrer,
        });
        sendJson(res, 200, { ok: true, ...result });
      } catch (err) {
        sendJson(res, 200, { ok: true, persisted: false, error: String(err.message || err) });
      }
      return;
    }
    sendJson(res, 400, { ok: false, error: "unknown action" });
    return;
  }

  sendJson(res, 405, { ok: false, error: "method not allowed" });
};
