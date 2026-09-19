const { cors, sendJson } = require("./_lib/docs-store");
const { readCustomProducts } = require("./_lib/products-store");

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
  sendJson(res, 200, { ok: true, products: readCustomProducts() });
};
