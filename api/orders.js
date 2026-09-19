const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join("/tmp", "shr-orders.json");

function readOrders() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return [];
  }
}

function writeOrders(orders) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(orders.slice(0, 500), null, 2));
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method === "POST") {
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        res.statusCode = 400;
        res.end(JSON.stringify({ ok: false, error: "invalid json" }));
        return;
      }
    }
    if (!body || !body.id || !body.shipping) {
      res.statusCode = 400;
      res.end(JSON.stringify({ ok: false, error: "missing fields" }));
      return;
    }
    const orders = readOrders();
    orders.unshift(body);
    writeOrders(orders);
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true, id: body.id }));
    return;
  }

  if (req.method === "GET") {
    const url = new URL(req.url, "http://localhost");
    const id = (url.searchParams.get("id") || "").toUpperCase();
    const phone = (url.searchParams.get("phone") || "").replace(/\s|-/g, "");
    if (!id || !phone) {
      res.statusCode = 400;
      res.end(JSON.stringify({ ok: false, error: "id and phone required" }));
      return;
    }
    const order = readOrders().find(
      (o) =>
        String(o.id).toUpperCase() === id &&
        String(o.shipping?.phone || "").replace(/\s|-/g, "") === phone
    );
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true, order: order || null }));
    return;
  }

  res.statusCode = 405;
  res.end(JSON.stringify({ ok: false, error: "method not allowed" }));
};
