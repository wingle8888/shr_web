const { cors, sendJson, checkAdmin, parseBody } = require("../_lib/docs-store");
const { readOrders, writeOrders, buildStats, extractCustomers, extractAddressStats } = require("../_lib/orders-store");
const { loadVisitStats } = require("../_lib/visits-store");
const { buildGeoStats } = require("../_lib/geo");

module.exports = async function handler(req, res) {
  cors(res);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-password");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  const body = parseBody(req);
  req.body = body;

  if (!(await checkAdmin(req))) {
    sendJson(res, 401, { ok: false, error: "unauthorized" });
    return;
  }

  if (req.method === "GET") {
    const onlyVisits = String(req.url || "").includes("only=visits");
    const visits = await loadVisitStats();
    if (onlyVisits) {
      sendJson(res, 200, { ok: true, visits });
      return;
    }
    const orders = await readOrders();
    sendJson(res, 200, {
      ok: true,
      orders,
      stats: buildStats(orders),
      customers: extractCustomers(orders),
      addressStats: extractAddressStats(orders),
      visits,
      geoStats: buildGeoStats(visits.countries, orders),
    });
    return;
  }

  if (req.method === "POST") {
    try {
      const action = String(body.action || "").trim();
      if (action === "import") {
        const incoming = Array.isArray(body.orders) ? body.orders : [];
        const current = await readOrders();
        const map = new Map();
        [...current, ...incoming].forEach((o) => {
          if (o && o.id) map.set(String(o.id), o);
        });
        const merged = Array.from(map.values()).sort((a, b) =>
          String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
        );
        await writeOrders(merged);
        sendJson(res, 200, { ok: true, count: merged.length });
        return;
      }
      if (action === "status") {
        const id = String(body.id || "").trim();
        const status = String(body.status || "").trim();
        if (!id || !status) {
          sendJson(res, 400, { ok: false, error: "id and status required" });
          return;
        }
        const orders = await readOrders();
        const idx = orders.findIndex((o) => String(o.id) === id);
        if (idx < 0) {
          sendJson(res, 404, { ok: false, error: "order not found" });
          return;
        }
        orders[idx].status = status;
        orders[idx].updatedAt = new Date().toISOString();
        await writeOrders(orders);
        sendJson(res, 200, { ok: true, order: orders[idx] });
        return;
      }
      sendJson(res, 400, { ok: false, error: "unknown action" });
    } catch (err) {
      sendJson(res, err && err.code === "BLOB_MISSING" ? 503 : 500, {
        ok: false,
        error: err && err.code === "BLOB_MISSING" ? "数据未能保存到服务器，请重试" : String(err.message || err),
      });
    }
    return;
  }

  sendJson(res, 405, { ok: false, error: "method not allowed" });
};
