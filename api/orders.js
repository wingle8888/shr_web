const { readOrders, writeOrders, findOrder } = require("./_lib/orders-store");
const { readRegisterPlace, inferCountryFromText, countryName, normalizeCountryCode } = require("./_lib/geo");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-password");

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
    try {
      try {
        const place = readRegisterPlace(req, body);
        const ship = body.shipping || {};
        const fromShip = inferCountryFromText(
          [ship.country, ship.region, ship.city, ship.address, ship.zip].filter(Boolean).join(" ")
        );
        const code =
          normalizeCountryCode(body.countryCode) || (place && place.countryCode) || fromShip || "";
        if (code) {
          body.countryCode = code;
          body.country = countryName(code) || body.country || "";
        }
        if (place) body.place = place;
      } catch (_) {}
      const orders = await readOrders();
      const idx = orders.findIndex((o) => String(o.id) === String(body.id));
      if (idx >= 0) orders[idx] = body;
      else orders.unshift(body);
      await writeOrders(orders);
    } catch (err) {
      res.statusCode = err && err.code === "BLOB_MISSING" ? 503 : 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: false, error: String(err.message || err) }));
      return;
    }
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true, id: body.id }));
    return;
  }

  if (req.method === "GET") {
    const url = new URL(req.url, "http://localhost");
    const id = url.searchParams.get("id") || "";
    const phone = url.searchParams.get("phone") || "";
    if (!id || !phone) {
      res.statusCode = 400;
      res.end(JSON.stringify({ ok: false, error: "id and phone required" }));
      return;
    }
    const order = await findOrder(id, phone);
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true, order: order || null }));
    return;
  }

  res.statusCode = 405;
  res.end(JSON.stringify({ ok: false, error: "method not allowed" }));
};
