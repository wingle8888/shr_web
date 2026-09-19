const { cors, sendJson, checkAdmin, parseBody } = require("../_lib/docs-store");
const {
  CATEGORIES,
  readCustomProducts,
  writeCustomProducts,
  normalizeProduct,
  saveProductImage,
} = require("../_lib/products-store");

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

  if (req.method === "GET") {
    if (!checkAdmin(req)) {
      sendJson(res, 401, { ok: false, error: "unauthorized" });
      return;
    }
    sendJson(res, 200, {
      ok: true,
      products: await readCustomProducts(),
      categories: CATEGORIES,
    });
    return;
  }

  if (!checkAdmin(req)) {
    sendJson(res, 401, { ok: false, error: "unauthorized" });
    return;
  }

  if (req.method === "POST") {
    const action = String(body.action || "create").trim();
    const list = await readCustomProducts();

    if (action === "delete") {
      const id = String(body.id || "").trim();
      const next = list.filter((p) => String(p.id) !== id);
      if (next.length === list.length) {
        sendJson(res, 404, { ok: false, error: "product not found" });
        return;
      }
      await writeCustomProducts(next);
      sendJson(res, 200, { ok: true });
      return;
    }

    try {
      if (action === "update") {
        const id = String(body.id || "").trim();
        const idx = list.findIndex((p) => String(p.id) === id);
        if (idx < 0) {
          sendJson(res, 404, { ok: false, error: "product not found" });
          return;
        }
        const updated = normalizeProduct(
          { ...list[idx], ...body, createdAt: list[idx].createdAt, img: body.img || list[idx].img },
          { id: list[idx].id }
        );
        if (body.imageBase64) {
          updated.img = await saveProductImage(updated.id, body.imageBase64, body.imageType);
        }
        list[idx] = updated;
        await writeCustomProducts(list);
        sendJson(res, 200, { ok: true, product: updated });
        return;
      }

      const existingIds = list.map((p) => p.id);
      if (Array.isArray(body.seedIds)) existingIds.push(...body.seedIds);
      const product = normalizeProduct(body, { existingIds });
      if (body.imageBase64) {
        product.img = await saveProductImage(product.id, body.imageBase64, body.imageType);
      }
      list.unshift(product);
      await writeCustomProducts(list);
      sendJson(res, 200, { ok: true, product });
    } catch (err) {
      sendJson(res, 400, { ok: false, error: String(err.message || err) });
    }
    return;
  }

  sendJson(res, 405, { ok: false, error: "method not allowed" });
};
