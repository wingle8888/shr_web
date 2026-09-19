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

  async function loadCustomProducts() {
    try {
      const res = await fetch("/api/products");
      const data = await res.json();
      if (res.ok && data.ok && Array.isArray(data.products)) return data.products;
    } catch (_) {}
    return [];
  }

  async function hydrateProducts() {
    const seed = Array.isArray(window.PRODUCTS) ? window.PRODUCTS.slice() : [];
    const custom = await loadCustomProducts();
    window.PRODUCTS = mergeProducts(seed, custom);
    window.PRODUCTS_SEED = seed;
    window.PRODUCTS_CUSTOM = custom;
    return window.PRODUCTS;
  }

  window.mergeProducts = mergeProducts;
  window.hydrateProducts = hydrateProducts;
})();
