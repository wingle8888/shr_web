(function () {
  const CART_KEY = "shr_cart_usd";
  const WH_PREFIX = "shr_warehouse_";

  let cache = emptyWarehouse();
  let loadedFor = "";
  let saveTimer = null;
  let tab = "purchases";

  function t(key, vars) {
    return window.I18N ? window.I18N.t(key, vars) : key;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function currentUser() {
    return window.Auth && window.Auth.currentUser ? window.Auth.currentUser() : null;
  }

  function userKey(user) {
    if (!user) return "";
    return String(user.id || user.email || "").trim().toLowerCase();
  }

  function emptyWarehouse() {
    return { cart: [], addresses: [], purchases: [], createdAt: "", updatedAt: "" };
  }

  function localStoreKey(user) {
    return WH_PREFIX + (userKey(user) || "guest");
  }

  function readLocal(user) {
    try {
      const data = JSON.parse(localStorage.getItem(localStoreKey(user)) || "null");
      if (!data || typeof data !== "object") return emptyWarehouse();
      return {
        cart: Array.isArray(data.cart) ? data.cart : [],
        addresses: Array.isArray(data.addresses) ? data.addresses : [],
        purchases: Array.isArray(data.purchases) ? data.purchases : [],
        createdAt: data.createdAt || "",
        updatedAt: data.updatedAt || "",
      };
    } catch {
      return emptyWarehouse();
    }
  }

  function writeLocal(user, data) {
    if (!user) return;
    localStorage.setItem(
      localStoreKey(user),
      JSON.stringify({
        cart: data.cart || [],
        addresses: data.addresses || [],
        purchases: data.purchases || [],
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    );
  }

  function readGuestCart() {
    try {
      const list = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  function mergeCart(a, b) {
    const map = new Map();
    [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])].forEach((item) => {
      if (!item || item.id == null) return;
      const key = String(item.id);
      const prev = map.get(key);
      const qty = Math.max(1, Number(item.qty) || 1);
      if (!prev) map.set(key, { ...item, qty });
      else map.set(key, { ...prev, ...item, qty: Math.max(prev.qty || 1, qty) });
    });
    return Array.from(map.values());
  }

  function addressKey(addr) {
    return [addr && addr.name, addr && addr.phone, addr && addr.region, addr && addr.address]
      .map((v) => String(v || "").trim().toLowerCase().replace(/\s+/g, " "))
      .join("|");
  }

  function mergeAddresses(a, b) {
    const map = new Map();
    [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])].forEach((addr) => {
      if (!addr) return;
      const key = addressKey(addr);
      if (!key || key === "|||") return;
      if (!map.has(key)) map.set(key, { ...addr, id: addr.id || `a${Date.now()}` });
    });
    return Array.from(map.values());
  }

  function mergePurchases(a, b) {
    const map = new Map();
    [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])].forEach((row) => {
      const id = row && (row.orderId || row.id);
      if (!id) return;
      const cur = { ...row, orderId: String(id) };
      const prev = map.get(cur.orderId);
      if (!prev || String(cur.createdAt || "") >= String(prev.createdAt || "")) map.set(cur.orderId, cur);
    });
    return Array.from(map.values()).sort((x, y) => String(y.createdAt || "").localeCompare(String(x.createdAt || "")));
  }

  function applyCache(data) {
    cache = {
      cart: Array.isArray(data && data.cart) ? data.cart : [],
      addresses: Array.isArray(data && data.addresses) ? data.addresses : [],
      purchases: Array.isArray(data && data.purchases) ? data.purchases : [],
      createdAt: (data && data.createdAt) || cache.createdAt || "",
      updatedAt: (data && data.updatedAt) || cache.updatedAt || "",
    };
  }

  async function fetchWarehouse() {
    const headers = Object.assign({ "Content-Type": "application/json" }, window.Auth.authHeader());
    const res = await fetch("/api/auth/warehouse", { headers, cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) return null;
    if (!res.ok || !data.ok || !data.warehouse) throw new Error(data.error || "warehouse unavailable");
    return data.warehouse;
  }

  async function postWarehouse(patch) {
    const headers = Object.assign({ "Content-Type": "application/json" }, window.Auth.authHeader());
    const res = await fetch("/api/auth/warehouse", {
      method: "POST",
      headers,
      body: JSON.stringify(patch || {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok || !data.warehouse) throw new Error(data.error || "warehouse save failed");
    return data.warehouse;
  }

  function applyPageCart(items) {
    if (window.SHRCart && typeof window.SHRCart.set === "function") {
      window.SHRCart.set(items, { fromWarehouse: true });
      return;
    }
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    const badge = document.getElementById("cartBadge");
    if (badge) {
      const count = items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
      badge.textContent = count;
      badge.style.display = count > 0 ? "inline-flex" : "none";
    }
  }

  async function loadWarehouse(force) {
    const user = currentUser();
    const key = userKey(user);
    if (!user || !key) {
      loadedFor = "";
      cache = emptyWarehouse();
      return cache;
    }
    if (!force && loadedFor === key) return cache;
    loadedFor = key;
    const local = readLocal(user);
    applyCache(local);
    let remoteOk = false;
    try {
      const remote = await fetchWarehouse();
      if (remote) {
        remoteOk = true;
        applyCache({
          cart: mergeCart(local.cart, remote.cart),
          addresses: mergeAddresses(local.addresses, remote.addresses),
          purchases: mergePurchases(local.purchases, remote.purchases),
          createdAt: remote.createdAt || local.createdAt,
          updatedAt: remote.updatedAt || local.updatedAt,
        });
      }
    } catch (_) {
      /* keep local copy when API is unavailable */
    }
    const mergedCart = mergeCart(readGuestCart(), cache.cart);
    cache.cart = mergedCart;
    writeLocal(user, cache);
    applyPageCart(mergedCart);
    if (remoteOk) persist({ cart: mergedCart }, true);
    return cache;
  }

  function persist(patch, immediate) {
    const user = currentUser();
    if (!user) return;
    if (patch && Array.isArray(patch.cart)) cache.cart = patch.cart;
    if (patch && patch.address) cache.addresses = mergeAddresses([patch.address], cache.addresses);
    if (patch && patch.removeAddressId) {
      cache.addresses = cache.addresses.filter((a) => String(a.id) !== String(patch.removeAddressId));
    }
    if (patch && patch.order) {
      cache.purchases = mergePurchases([patch.order], cache.purchases);
      if (patch.order.shipping) cache.addresses = mergeAddresses([patch.order.shipping], cache.addresses);
    }
    writeLocal(user, cache);
    const run = async () => {
      try {
        const remote = await postWarehouse(patch);
        if (remote) applyCache(remote);
        writeLocal(user, cache);
        renderIfOpen();
      } catch (_) {}
    };
    if (immediate) {
      run();
      return;
    }
    clearTimeout(saveTimer);
    saveTimer = setTimeout(run, 400);
  }

  function ensureModal() {
    if (document.getElementById("warehouseModal")) return;
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.id = "warehouseModal";
    overlay.innerHTML = `
      <div class="modal modal-wide warehouse-modal">
        <div class="modal-header">
          <h3 data-i18n="warehouseTitle">我的仓库</h3>
          <button class="modal-close" id="warehouseClose" type="button">&times;</button>
        </div>
        <div class="warehouse-tabs" role="tablist">
          <button type="button" class="active" data-wh-tab="purchases" data-i18n="warehousePurchases">已购产品</button>
          <button type="button" class="warehouse-tab" data-wh-tab="addresses" data-i18n="warehouseAddresses">收货地址</button>
          <button type="button" class="warehouse-tab" data-wh-tab="cart" data-i18n="warehouseCart">购物车</button>
        </div>
        <p class="warehouse-hint" data-i18n="warehouseHint">注册账号专属仓库：已购商品、收货地址和购物车会保存在这里。</p>
        <div class="modal-body" id="warehouseBody"></div>
        <div class="modal-footer">
          <button class="btn btn-sm" type="button" id="warehouseGoCart" data-i18n="warehouseOpenCart">打开购物车</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener("click", (e) => {
      if (e.target.id === "warehouseModal") close();
    });
    document.getElementById("warehouseClose").addEventListener("click", close);
    overlay.querySelector(".warehouse-tabs").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-wh-tab]");
      if (!btn) return;
      tab = btn.getAttribute("data-wh-tab") || "purchases";
      overlay.querySelectorAll("[data-wh-tab]").forEach((el) => el.classList.toggle("active", el === btn));
      render();
    });
    document.getElementById("warehouseGoCart").addEventListener("click", () => {
      close();
      const cartBtn = document.getElementById("cartBtn");
      if (cartBtn) cartBtn.click();
    });
    overlay.addEventListener("click", (e) => {
      const useBtn = e.target.closest("[data-use-address]");
      if (useBtn) {
        useAddress(useBtn.getAttribute("data-use-address"));
        return;
      }
      const qtyBtn = e.target.closest("[data-wh-qty]");
      if (qtyBtn) {
        changeWarehouseQty(qtyBtn.getAttribute("data-wh-id"), Number(qtyBtn.getAttribute("data-wh-qty")));
        return;
      }
      const rmBtn = e.target.closest("[data-wh-remove]");
      if (rmBtn) {
        changeWarehouseQty(rmBtn.getAttribute("data-wh-remove"), -999);
      }
    });
  }

  function locale() {
    return window.I18N && window.I18N.getLang && window.I18N.getLang() === "en" ? "en-US" : "zh-CN";
  }

  function money(n) {
    return "$" + (Number(n) || 0).toFixed(2);
  }

  function renderPurchases() {
    if (!cache.purchases.length) {
      return `<div class="warehouse-empty">${escapeHtml(t("warehouseEmptyPurchases"))}</div>`;
    }
    return cache.purchases
      .map((row) => {
        const items = (row.items || [])
          .map(
            (i) => `
          <div class="cart-item">
            ${i.img ? `<img src="${escapeHtml(i.img)}" alt="">` : ""}
            <div class="cart-item-info">
              <div class="cart-item-title">${escapeHtml(i.name || "")}</div>
              <div class="cart-item-price">${money(i.price)} × ${escapeHtml(i.qty)}</div>
            </div>
          </div>`
          )
          .join("");
        const ship = row.shipping || {};
        const when = row.createdAt ? new Date(row.createdAt).toLocaleString(locale()) : "";
        return `
          <article class="order-card warehouse-card">
            <div class="order-card-head">
              <strong>${escapeHtml(row.orderId || "")}</strong>
              <span>${escapeHtml(row.status || "")}</span>
            </div>
            <p>${escapeHtml(t("orderTime"))}${escapeHtml(when)}</p>
            ${row.payMethod ? `<p>${escapeHtml(t("payMethod"))}${escapeHtml(row.payMethod)}</p>` : ""}
            ${
              ship.name
                ? `<p>${escapeHtml(t("receiver"))}${escapeHtml(ship.name)} / ${escapeHtml(ship.phone || "")}</p>`
                : ""
            }
            ${
              ship.address
                ? `<p>${escapeHtml(t("address"))}${escapeHtml(ship.region || "")} ${escapeHtml(ship.address)}</p>`
                : ""
            }
            ${items}
            <p class="order-total">${escapeHtml(t("orderTotal"))}${Number(row.total || 0).toFixed(2)}</p>
          </article>`;
      })
      .join("");
  }

  function renderAddresses() {
    if (!cache.addresses.length) {
      return `<div class="warehouse-empty">${escapeHtml(t("warehouseEmptyAddresses"))}</div>`;
    }
    return cache.addresses
      .map((addr) => {
        const id = escapeHtml(addr.id || "");
        return `
          <article class="order-card warehouse-card">
            <p><strong>${escapeHtml(addr.name || "")}</strong> · ${escapeHtml(addr.phone || "")}</p>
            <p>${escapeHtml(addr.region || "")} ${escapeHtml(addr.address || "")}</p>
            ${addr.zip ? `<p>${escapeHtml(t("shipZip").replace(" *", "").replace("（选填）", ""))} ${escapeHtml(addr.zip)}</p>` : ""}
            ${addr.email ? `<p>${escapeHtml(t("email"))}${escapeHtml(addr.email)}</p>` : ""}
            ${addr.note ? `<p>${escapeHtml(t("remark"))}${escapeHtml(addr.note)}</p>` : ""}
            <button type="button" class="btn btn-sm" data-use-address="${id}">${escapeHtml(t("warehouseUseAddress"))}</button>
          </article>`;
      })
      .join("");
  }

  function renderCartTab() {
    if (!cache.cart.length) {
      return `<div class="warehouse-empty">${escapeHtml(t("warehouseEmptyCart"))}</div>`;
    }
    const rows = cache.cart
      .map(
        (item) => `
      <div class="cart-item">
        ${item.img ? `<img src="${escapeHtml(item.img)}" alt="${escapeHtml(item.name || "")}">` : ""}
        <div class="cart-item-info">
          <div class="cart-item-title">${escapeHtml(item.name || "")}</div>
          <div class="cart-item-price">${money(item.price)}</div>
          <div class="qty-row">
            <button type="button" data-wh-qty="-1" data-wh-id="${escapeHtml(item.id)}">−</button>
            <span>${escapeHtml(item.qty)}</span>
            <button type="button" data-wh-qty="1" data-wh-id="${escapeHtml(item.id)}">+</button>
          </div>
        </div>
        <button class="cart-remove" type="button" data-wh-remove="${escapeHtml(item.id)}">${escapeHtml(t("remove"))}</button>
      </div>`
      )
      .join("");
    const total = cache.cart.reduce((sum, item) => sum + Number(item.price) * Number(item.qty), 0);
    return `${rows}<p class="order-total">${escapeHtml(t("total"))}${total.toFixed(2)}</p>`;
  }

  function render() {
    const body = document.getElementById("warehouseBody");
    if (!body) return;
    if (window.I18N) window.I18N.applyI18n();
    if (tab === "addresses") body.innerHTML = renderAddresses();
    else if (tab === "cart") body.innerHTML = renderCartTab();
    else body.innerHTML = renderPurchases();
  }

  function renderIfOpen() {
    const overlay = document.getElementById("warehouseModal");
    if (overlay && overlay.classList.contains("show")) render();
  }

  function changeWarehouseQty(id, delta) {
    const pid = String(id);
    cache.cart = cache.cart
      .map((item) => {
        if (String(item.id) !== pid) return item;
        return { ...item, qty: Number(item.qty) + delta };
      })
      .filter((item) => Number(item.qty) > 0);
    applyPageCart(cache.cart);
    persist({ cart: cache.cart });
    render();
  }

  function useAddress(id) {
    const addr = cache.addresses.find((a) => String(a.id) === String(id));
    if (!addr) return;
    const map = {
      shipName: addr.name,
      shipPhone: addr.phone,
      shipEmail: addr.email,
      shipRegion: addr.region,
      shipZip: addr.zip,
      shipAddress: addr.address,
      shipNote: addr.note,
    };
    Object.keys(map).forEach((key) => {
      const el = document.getElementById(key);
      if (el) el.value = map[key] || "";
    });
    close();
    if (document.getElementById("checkoutForm")) {
      const cartModal = document.getElementById("cartModal");
      if (cartModal) cartModal.classList.remove("show");
      const checkout = document.getElementById("checkoutModal");
      if (checkout) checkout.classList.add("show");
    } else {
      location.href = "/#products";
    }
    const toast = document.getElementById("toast");
    if (toast) {
      toast.textContent = t("warehouseAddressApplied");
      toast.classList.add("show");
      setTimeout(() => toast.classList.remove("show"), 2400);
    }
  }

  async function open() {
    const user = currentUser();
    if (!user) return;
    ensureModal();
    await loadWarehouse();
    if (window.I18N) window.I18N.applyI18n();
    const overlay = document.getElementById("warehouseModal");
    overlay.classList.add("show");
    render();
  }

  function close() {
    const overlay = document.getElementById("warehouseModal");
    if (overlay) overlay.classList.remove("show");
  }

  function bindUi() {
    const btn = document.getElementById("warehouseBtn");
    if (btn && !btn.dataset.whBound) {
      btn.dataset.whBound = "1";
      btn.addEventListener("click", () => open());
    }
    const userEl = document.getElementById("authUser");
    if (userEl && !userEl.dataset.whBound) {
      userEl.dataset.whBound = "1";
      userEl.style.cursor = "pointer";
      userEl.addEventListener("click", () => {
        if (currentUser()) open();
      });
    }
  }

  function refreshButton() {
    const btn = document.getElementById("warehouseBtn");
    if (btn) btn.hidden = !currentUser();
  }

  async function onAuthChange() {
    bindUi();
    refreshButton();
    const user = currentUser();
    if (!user) {
      loadedFor = "";
      cache = emptyWarehouse();
      close();
      return;
    }
    await loadWarehouse(true);
  }

  function syncCart(items, meta) {
    if (!currentUser()) return;
    if (meta && meta.fromWarehouse) {
      cache.cart = Array.isArray(items) ? items : [];
      writeLocal(currentUser(), cache);
      return;
    }
    cache.cart = Array.isArray(items) ? items : [];
    persist({ cart: cache.cart });
    renderIfOpen();
  }

  function recordOrder(order) {
    if (!currentUser() || !order) return;
    persist({ order, cart: cache.cart }, true);
    renderIfOpen();
  }

  function saveAddress(addr) {
    if (!currentUser() || !addr) return;
    persist({ address: addr }, true);
    renderIfOpen();
  }

  window.Warehouse = {
    open,
    close,
    onAuthChange,
    syncCart,
    recordOrder,
    saveAddress,
    load: loadWarehouse,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      bindUi();
      refreshButton();
    });
  } else {
    bindUi();
    refreshButton();
  }
})();
