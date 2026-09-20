const { cors, sendJson, parseBody, resolveUserFromToken } = require("../_lib/auth-store");
const { readOrders, writeOrders } = require("../_lib/orders-store");
const { orderStage, statusForStage, publicOrder } = require("../_lib/order-status");
const { patchWarehouse } = require("../_lib/warehouse-store");

function tokenFrom(req) {
  const auth = req.headers.authorization || req.headers.Authorization || "";
  return auth.startsWith("Bearer ") ? auth.slice(7) : "";
}

function orderMatchesUser(order, user) {
  if (!order || !user) return false;
  const id = String(user.id || "").trim();
  const email = String(user.email || "").trim().toLowerCase();
  if (id && String(order.userId || "") === id) return true;
  if (email && String(order.userEmail || "").trim().toLowerCase() === email) return true;
  const shipEmail = String((order.shipping && order.shipping.email) || "").trim().toLowerCase();
  if (email && shipEmail && shipEmail === email) return true;
  return false;
}

async function listMine(user) {
  const orders = await readOrders();
  return (Array.isArray(orders) ? orders : [])
    .filter((order) => orderMatchesUser(order, user))
    .map(publicOrder)
    .filter(Boolean);
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  const token = tokenFrom(req);
  let user;
  try {
    user = await resolveUserFromToken(token);
  } catch (err) {
    sendJson(res, 500, { ok: false, error: String(err.message || err) });
    return;
  }
  if (!user) {
    sendJson(res, 401, { ok: false, error: "unauthorized" });
    return;
  }

  if (req.method === "GET") {
    try {
      sendJson(res, 200, { ok: true, orders: await listMine(user) });
    } catch (err) {
      sendJson(res, err && err.code === "BLOB_MISSING" ? 503 : 500, {
        ok: false,
        error: String(err.message || err),
      });
    }
    return;
  }

  if (req.method === "POST") {
    const body = parseBody(req);
    const action = String((body && body.action) || "").trim();
    const id = String((body && (body.id || body.orderId)) || "").trim();
    if (!id || (action !== "receive" && action !== "refund")) {
      sendJson(res, 400, { ok: false, error: "invalid action" });
      return;
    }
    try {
      const orders = await readOrders();
      const idx = orders.findIndex((row) => String(row.id) === id && orderMatchesUser(row, user));
      if (idx < 0) {
        sendJson(res, 404, { ok: false, error: "order not found" });
        return;
      }
      const stage = orderStage(orders[idx]);
      if (action === "receive" && stage !== "shipped") {
        sendJson(res, 400, { ok: false, error: "not awaiting delivery" });
        return;
      }
      if (action === "refund" && stage !== "paid" && stage !== "shipped") {
        sendJson(res, 400, { ok: false, error: "cannot refund" });
        return;
      }
      const nextStage = action === "receive" ? "received" : "refund";
      orders[idx].status = statusForStage(nextStage);
      orders[idx].updatedAt = new Date().toISOString();
      await writeOrders(orders);
      try {
        await patchWarehouse(user, { order: orders[idx] });
      } catch (_) {}
      sendJson(res, 200, { ok: true, order: publicOrder(orders[idx]) });
    } catch (err) {
      sendJson(res, err && err.code === "BLOB_MISSING" ? 503 : 500, {
        ok: false,
        error: String(err.message || err),
      });
    }
    return;
  }

  sendJson(res, 405, { ok: false, error: "method not allowed" });
};
