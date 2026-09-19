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
      const res = await fetch("/api/products");
      const data = await res.json();
      if (res.ok && data.ok) {
        return {
          products: Array.isArray(data.products) ? data.products : [],
          hiddenIds: Array.isArray(data.hiddenIds) ? data.hiddenIds.map(String) : [],
        };
      }
    } catch (_) {}
    return { products: [], hiddenIds: [] };
  }

  async function hydrateProducts() {
    const seed = Array.isArray(window.PRODUCTS) ? window.PRODUCTS.slice() : [];
    const catalog = await loadCatalog();
    const hidden = new Set(catalog.hiddenIds);
    const merged = mergeProducts(seed, catalog.products);
    window.PRODUCTS_SEED = seed;
    window.PRODUCTS_CUSTOM = catalog.products;
    window.PRODUCTS_HIDDEN = hidden;
    window.PRODUCTS = merged.filter((p) => !hidden.has(String(p.id)));
    return window.PRODUCTS;
  }

  window.mergeProducts = mergeProducts;
  window.hydrateProducts = hydrateProducts;
})();
