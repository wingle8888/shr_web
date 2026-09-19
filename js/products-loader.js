(function () {
  function mergeProducts(seed, custom) {
    const map = new Map();
    (seed || []).forEach((p) => map.set(String(p.id), p));
    (custom || []).forEach((p) => {
      const id = String(p.id);
      const prev = map.get(id) || {};
      map.set(id, { ...prev, ...p, custom: true });
    });
    return Array.from(map.values()).sort((a, b) => Number(a.id) - Number(b.id));
  }

  async function loadCatalog() {
    try {
      const res = await fetch("/api/products", { cache: "no-store" });
      const data = await res.json();
      if (res.ok && data.ok) {
        return {
          complete: Boolean(data.complete),
          products: Array.isArray(data.products) ? data.products : [],
          hiddenIds: Array.isArray(data.hiddenIds) ? data.hiddenIds.map(String) : [],
          deletedIds: Array.isArray(data.deletedIds) ? data.deletedIds.map(String) : [],
          galleries: data.galleries && typeof data.galleries === "object" ? data.galleries : {},
        };
      }
    } catch (_) {}
    return { complete: false, products: [], hiddenIds: [], deletedIds: [], galleries: {} };
  }

  async function hydrateProducts() {
    const seed = Array.isArray(window.PRODUCTS) ? window.PRODUCTS.slice() : [];
    const catalog = await loadCatalog();
    const hidden = new Set(catalog.hiddenIds);
    const deleted = new Set(catalog.deletedIds);
    const visible = catalog.complete
      ? catalog.products.filter((p) => !hidden.has(String(p.id)) && !deleted.has(String(p.id)))
      : mergeProducts(seed, catalog.products)
          .map((p) => {
            const extra = catalog.galleries[String(p.id)];
            return extra ? { ...p, images: extra } : p;
          })
          .filter((p) => !hidden.has(String(p.id)) && !deleted.has(String(p.id)));
    window.PRODUCTS_SEED = seed;
    window.PRODUCTS_CUSTOM = catalog.complete ? [] : catalog.products;
    window.PRODUCTS_HIDDEN = hidden;
    window.PRODUCTS_DELETED = deleted;
    window.PRODUCTS_GALLERIES = catalog.galleries;
    window.PRODUCTS = visible;
    return window.PRODUCTS;
  }

  window.mergeProducts = mergeProducts;
  window.hydrateProducts = hydrateProducts;
})();
