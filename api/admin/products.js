const { storageKind } = require("../_lib/blob-store");
const { cors, sendJson, checkAdmin, parseBody } = require("../_lib/docs-store");
const {
  catalogCategories,
  readCatalog,
  readCustomProducts,
  writeCustomProducts,
  setProductsHidden,
  deleteProducts,
  addCategory,
  removeCategory,
  normalizeProduct,
  saveProductImage,
  addGalleryImages,
  updateGalleryCaption,
  removeGalleryImage,
  attachGalleries,
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
    const catalog = await readCatalog();
    const deleted = new Set((catalog.deletedIds || []).map(String));
    sendJson(res, 200, {
      ok: true,
      products: attachGalleries(catalog.products, catalog.galleries).filter((p) => !deleted.has(String(p.id))),
      hiddenIds: catalog.hiddenIds,
      deletedIds: catalog.deletedIds,
      galleries: catalog.galleries,
      categories: catalogCategories(catalog),
      storage: storageKind() || "none",
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

    if (action === "category-add") {
      try {
        const categories = await addCategory(body);
        sendJson(res, 200, { ok: true, categories });
      } catch (err) {
        sendJson(res, err && err.code === "BLOB_MISSING" ? 503 : 400, {
          ok: false,
          error: err && err.code === "BLOB_MISSING" ? "数据未能保存到服务器，请重试" : String(err.message || err),
        });
      }
      return;
    }

    if (action === "category-remove") {
      const id = String(body.id || "").trim();
      if (!id) {
        sendJson(res, 400, { ok: false, error: "id required" });
        return;
      }
      try {
        const categories = await removeCategory(id);
        sendJson(res, 200, { ok: true, categories });
      } catch (err) {
        sendJson(res, err && err.code === "BLOB_MISSING" ? 503 : 400, {
          ok: false,
          error: err && err.code === "BLOB_MISSING" ? "数据未能保存到服务器，请重试" : String(err.message || err),
        });
      }
      return;
    }

    if (action === "hide" || action === "show") {
      const ids = Array.isArray(body.ids) ? body.ids : body.id != null ? [body.id] : [];
      if (!ids.length) {
        sendJson(res, 400, { ok: false, error: "ids required" });
        return;
      }
      try {
        const catalog = await setProductsHidden(ids, action === "hide");
        sendJson(res, 200, { ok: true, hiddenIds: catalog.hiddenIds, storage: storageKind() || "none" });
      } catch (err) {
        const raw = String((err && err.message) || err || "");
        const rpc = /RPC receiver|does not implement the method/i.test(raw);
        sendJson(res, 503, {
          ok: false,
          error: rpc || (err && err.code === "BLOB_MISSING") ? "数据未能保存到服务器，请重试" : raw,
        });
      }
      return;
    }

    if (action === "gallery-add") {
      const id = String(body.id || "").trim();
      const payloads = Array.isArray(body.images) ? body.images : body.imageBase64 ? [body] : [];
      if (!id || !payloads.length) {
        sendJson(res, 400, { ok: false, error: "id and images required" });
        return;
      }
      try {
        const images = await addGalleryImages(id, payloads);
        sendJson(res, 200, { ok: true, images });
      } catch (err) {
        sendJson(res, err && err.code === "BLOB_MISSING" ? 503 : 500, {
          ok: false,
          error: err && err.code === "BLOB_MISSING" ? "数据未能保存到服务器，请重试" : String(err.message || err),
        });
      }
      return;
    }

    if (action === "gallery-caption") {
      const id = String(body.id || "").trim();
      const imageId = String(body.imageId || "").trim();
      if (!id || !imageId) {
        sendJson(res, 400, { ok: false, error: "id and imageId required" });
        return;
      }
      try {
        const images = await updateGalleryCaption(id, imageId, body.caption);
        sendJson(res, 200, { ok: true, images });
      } catch (err) {
        sendJson(res, err && err.code === "BLOB_MISSING" ? 503 : 500, {
          ok: false,
          error: err && err.code === "BLOB_MISSING" ? "数据未能保存到服务器，请重试" : String(err.message || err),
        });
      }
      return;
    }

    if (action === "gallery-remove") {
      const id = String(body.id || "").trim();
      const imageId = String(body.imageId || "").trim();
      if (!id || !imageId) {
        sendJson(res, 400, { ok: false, error: "id and imageId required" });
        return;
      }
      try {
        const images = await removeGalleryImage(id, imageId);
        sendJson(res, 200, { ok: true, images });
      } catch (err) {
        sendJson(res, err && err.code === "BLOB_MISSING" ? 503 : 500, {
          ok: false,
          error: err && err.code === "BLOB_MISSING" ? "数据未能保存到服务器，请重试" : String(err.message || err),
        });
      }
      return;
    }

    if (action === "delete") {
      const ids = Array.isArray(body.ids) ? body.ids : body.id != null ? [body.id] : [];
      if (!ids.length) {
        sendJson(res, 400, { ok: false, error: "ids required" });
        return;
      }
      try {
        const catalog = await deleteProducts(ids);
        sendJson(res, 200, { ok: true, deletedIds: catalog.deletedIds, count: ids.length });
      } catch (err) {
        const missing = err && err.code === "BLOB_MISSING";
        sendJson(res, missing ? 503 : 500, {
          ok: false,
          error: missing ? "数据未能保存到服务器，请重试" : String(err.message || err),
        });
      }
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
      sendJson(res, err && err.code === "BLOB_MISSING" ? 503 : 400, {
        ok: false,
        error: err && err.code === "BLOB_MISSING" ? "数据未能保存到服务器，请重试" : String(err.message || err),
      });
    }
    return;
  }

  sendJson(res, 405, { ok: false, error: "method not allowed" });
};
