const { cors, sendJson, parseBody } = require("./_lib/docs-store");
const { readCustomProducts } = require("./_lib/products-store");
const { recordVisit } = require("./_lib/visits-store");

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method === "GET") {
    sendJson(res, 200, { ok: true, products: readCustomProducts() });
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
      const result = recordVisit({
        visitorId: body.visitorId,
        pathName: pathName || "/",
        referrer: body.referrer,
      });
      sendJson(res, 200, { ok: true, ...result });
      return;
    }
    sendJson(res, 400, { ok: false, error: "unknown action" });
    return;
  }

  sendJson(res, 405, { ok: false, error: "method not allowed" });
};
