const CATEGORY_ORDER = [
  { id: "cat-mcu", nameKey: "catMcu", descKey: "catMcuDesc" },
  { id: "cat-iot", nameKey: "catIot", descKey: "catIotDesc" },
  { id: "cat-sbc", nameKey: "catSbc", descKey: "catSbcDesc" },
  { id: "cat-display", nameKey: "catDisplay", descKey: "catDisplayDesc" },
  { id: "cat-sensor", nameKey: "catSensor", descKey: "catSensorDesc" },
];

const CART_KEY = "shr_cart_usd";
const ORDERS_KEY = "shr_orders";

let products = window.PRODUCTS || [];
let cart = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
let currentCategory = "all";
let searchKeyword = "";

function t(key, vars) {
  return window.I18N ? window.I18N.t(key, vars) : key;
}

function locProduct(p) {
  return window.getLocalizedProduct ? window.getLocalizedProduct(p) : p;
}

function mallCategories() {
  const remote = Array.isArray(window.PRODUCT_CATEGORIES) ? window.PRODUCT_CATEGORIES : [];
  if (remote.length) return remote;
  return CATEGORY_ORDER.map((c) => ({
    id: c.id,
    nameKey: c.nameKey,
    descKey: c.descKey,
    name: t(c.nameKey),
    desc: t(c.descKey),
  }));
}

function categoryTitle(cat) {
  if (cat.nameKey) {
    const label = t(cat.nameKey);
    if (label && label !== cat.nameKey) return label;
  }
  if (window.I18N && window.I18N.getLang && window.I18N.getLang() === "en" && cat.nameEn) return cat.nameEn;
  return cat.name || cat.id;
}

function categoryDesc(cat) {
  if (cat.descKey) {
    const label = t(cat.descKey);
    if (label && label !== cat.descKey) return label;
  }
  if (window.I18N && window.I18N.getLang && window.I18N.getLang() === "en" && cat.descEn) return cat.descEn;
  return cat.desc || "";
}

const CATEGORY_ICON_PATHS = {
  all: '<rect x="4" y="4" width="7" height="7" rx="1"></rect><rect x="13" y="4" width="7" height="7" rx="1"></rect><rect x="4" y="13" width="7" height="7" rx="1"></rect><rect x="13" y="13" width="7" height="7" rx="1"></rect>',
  "cat-mcu":
    '<rect x="7" y="7" width="10" height="10" rx="1.5"></rect><path d="M9 3v4M12 3v4M15 3v4M9 17v4M12 17v4M15 17v4M3 9h4M3 12h4M3 15h4M17 9h4M17 12h4M17 15h4"></path>',
  "cat-iot":
    '<path d="M5 10a8.5 8.5 0 0 1 14 0"></path><path d="M8 13.5a5 5 0 0 1 8 0"></path><path d="M11 17a1.5 1.5 0 0 1 2 0"></path><circle cx="12" cy="20" r="1" fill="currentColor"></circle>',
  "cat-sbc":
    '<rect x="3" y="4" width="18" height="12" rx="2"></rect><path d="M8 20h8M12 16v4"></path>',
  "cat-display":
    '<rect x="3" y="4" width="18" height="13" rx="2"></rect><path d="M8 21h8M12 17v4"></path>',
  "cat-sensor":
    '<path d="M3 12h3l2.5-7 4 14 2.5-7H21"></path>',
  default:
    '<path d="M20.6 13.1 12.7 21a2 2 0 0 1-2.8 0l-7-7a2 2 0 0 1 0-2.8l7.9-7.9A2 2 0 0 1 12.2 3H19a2 2 0 0 1 2 2v6.8a2 2 0 0 1-.4 1.3z"></path><circle cx="15.5" cy="8.5" r="1.2" fill="currentColor"></circle>',
};

function categoryIconKey(cat) {
  const id = typeof cat === "string" ? cat : (cat && cat.id) || "";
  if (CATEGORY_ICON_PATHS[id]) return id;
  const name = typeof cat === "object" && cat ? String(cat.name || "") : "";
  if (/电源|稳压|power/i.test(name)) return "cat-iot";
  if (/显示|屏幕|屏/i.test(name)) return "cat-display";
  if (/传感|模块/i.test(name)) return "cat-sensor";
  return "default";
}

function categoryIcon(cat) {
  const key = categoryIconKey(cat);
  return `<svg class="cat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${CATEGORY_ICON_PATHS[key] || CATEGORY_ICON_PATHS.default}</svg>`;
}

function renderCategoryTabs() {
  const wrap = document.getElementById("categoryTabs");
  if (!wrap) return;
  const cats = mallCategories();
  const valid = new Set(["all", ...cats.map((c) => c.id)]);
  if (!valid.has(currentCategory)) currentCategory = "all";
  wrap.innerHTML = [
    `<button type="button" class="${currentCategory === "all" ? "active" : ""}" data-cat="all">${categoryIcon("all")}<span>${escapeHtml(t("catAll"))}</span></button>`,
    ...cats.map(
      (cat) =>
        `<button type="button" class="${currentCategory === cat.id ? "active" : ""}" data-cat="${escapeHtml(cat.id)}">${categoryIcon(cat)}<span>${escapeHtml(categoryTitle(cat))}</span></button>`
    ),
  ].join("");
}

function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2800);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function saveCart(meta) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartBadge();
  if (!(meta && meta.fromWarehouse) && window.Warehouse) window.Warehouse.syncCart(cart);
}

function updateCartBadge() {
  const badge = document.getElementById("cartBadge");
  const count = cart.reduce((sum, item) => sum + item.qty, 0);
  badge.textContent = count;
  badge.style.display = count > 0 ? "inline-flex" : "none";
}

function getFilteredProducts() {
  return products
    .map(locProduct)
    .filter((p) => {
      const catOk = currentCategory === "all" || p.categoryId === currentCategory;
      const q = searchKeyword.trim().toLowerCase();
      const searchOk =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.desc.toLowerCase().includes(q) ||
        p.tag.toLowerCase().includes(q) ||
        String(p.category || "").toLowerCase().includes(q);
      return catOk && searchOk;
    });
}

function productCardHtml(raw) {
  const p = locProduct(raw);
  return `
    <div class="card">
      <a class="card-link" href="/product.html?id=${p.id}">
        <div class="card-img-wrap">
          <img src="${p.img}" alt="${escapeHtml(p.name)}" loading="lazy">
          <span class="card-tag">${escapeHtml(p.tag)}</span>
        </div>
        <div class="card-body">
          <h3>${escapeHtml(p.name)}</h3>
          <p class="card-desc">${escapeHtml(p.desc)}</p>
        </div>
      </a>
      <div class="card-bottom card-bottom-pad">
        <div class="card-price"><small>$</small>${Number(p.price).toFixed(2)}</div>
        <button class="btn btn-sm" type="button" onclick="addToCart(${p.id})">${t("addToCart")}</button>
      </div>
    </div>
  `;
}

function renderProducts() {
  const sectionsEl = document.getElementById("categorySections");
  const grid = document.getElementById("productsGrid");
  const list = getFilteredProducts();

  if (currentCategory === "all" && !searchKeyword.trim()) {
    grid.hidden = true;
    grid.innerHTML = "";
    sectionsEl.hidden = false;
    sectionsEl.innerHTML = mallCategories().map((cat) => {
      const items = products.filter((p) => p.categoryId === cat.id);
      if (items.length === 0) return "";
      const desc = categoryDesc(cat);
      return `
        <div class="category-block" id="${escapeHtml(cat.id)}">
          <div class="category-head">
            <div>
              <h3>${categoryIcon(cat)}<span>${escapeHtml(categoryTitle(cat))}</span></h3>
              ${desc ? `<p>${escapeHtml(desc)}</p>` : ""}
            </div>
            <span class="category-count">${t("itemsCount", { n: items.length })}</span>
          </div>
          <div class="products-grid">
            ${items.map(productCardHtml).join("")}
          </div>
        </div>
      `;
    }).join("");
    return;
  }

  sectionsEl.hidden = true;
  sectionsEl.innerHTML = "";
  grid.hidden = false;
  if (list.length === 0) {
    grid.innerHTML = `<div class="empty-products">${t("noProducts")}</div>`;
    return;
  }
  grid.innerHTML = list.map(productCardHtml).join("");
}

function addToCart(id) {
  const product = locProduct(products.find((p) => p.id === id));
  if (!product) return;
  const existing = cart.find((item) => item.id === id);
  if (existing) existing.qty += 1;
  else cart.push({ id: product.id, name: product.name, price: product.price, img: product.img, qty: 1 });
  saveCart();
  showToast(t("addedCart", { name: product.name }));
}

function changeQty(id, delta) {
  const item = cart.find((i) => i.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart = cart.filter((i) => i.id !== id);
  saveCart();
  renderCart();
}

function removeFromCart(id) {
  cart = cart.filter((item) => item.id !== id);
  saveCart();
  renderCart();
}

function cartTotal() {
  return cart.reduce((sum, item) => sum + item.price * item.qty, 0);
}

function renderCart() {
  const body = document.getElementById("cartBody");
  const totalEl = document.getElementById("cartTotal");
  if (cart.length === 0) {
    body.innerHTML = `<div class="cart-empty">${t("cartEmpty")}</div>`;
    totalEl.textContent = "0.00";
    return;
  }
  body.innerHTML = cart
    .map(
      (item) => `
    <div class="cart-item">
      <img src="${item.img}" alt="${escapeHtml(item.name)}">
      <div class="cart-item-info">
        <div class="cart-item-title">${escapeHtml(item.name)}</div>
        <div class="cart-item-price">$${Number(item.price).toFixed(2)}</div>
        <div class="qty-row">
          <button type="button" onclick="changeQty(${item.id}, -1)">−</button>
          <span>${item.qty}</span>
          <button type="button" onclick="changeQty(${item.id}, 1)">+</button>
        </div>
      </div>
      <button class="cart-remove" type="button" onclick="removeFromCart(${item.id})">${t("remove")}</button>
    </div>
  `
    )
    .join("");
  totalEl.textContent = cartTotal().toFixed(2);
}

function openModal(id) {
  document.getElementById(id).classList.add("show");
}

function closeModal(id) {
  document.getElementById(id).classList.remove("show");
}

function openCart() {
  renderCart();
  openModal("cartModal");
}

function openCheckout() {
  if (cart.length === 0) {
    showToast(t("cartIsEmpty"));
    return;
  }
  closeModal("cartModal");
  document.getElementById("checkoutTotal").textContent = cartTotal().toFixed(2);
  if (window.Auth) window.Auth.prefillCheckoutFromUser();
  openModal("checkoutModal");
}

function loadOrders() {
  try {
    return JSON.parse(localStorage.getItem(ORDERS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveOrders(orders) {
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
}

function generateOrderId() {
  const now = new Date();
  const pad = (n, len = 2) => String(n).padStart(len, "0");
  const stamp =
    now.getFullYear() +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    pad(now.getSeconds());
  const rand = pad(Math.floor(Math.random() * 1000), 3);
  return `SHR${stamp}${rand}`;
}

function normalizePhone(phone) {
  return String(phone || "").replace(/\s|-/g, "");
}

async function submitOrder(e) {
  e.preventDefault();
  if (cart.length === 0) {
    showToast(t("cartIsEmpty"));
    return;
  }

  const shipping = {
    name: document.getElementById("shipName").value.trim(),
    phone: document.getElementById("shipPhone").value.trim(),
    email: document.getElementById("shipEmail").value.trim(),
    region: document.getElementById("shipRegion").value.trim(),
    zip: document.getElementById("shipZip").value.trim(),
    address: document.getElementById("shipAddress").value.trim(),
    note: document.getElementById("shipNote").value.trim(),
  };
  const payMethod = document.querySelector('input[name="payMethod"]:checked')?.value || "PayPal";

  if (!shipping.name || !shipping.phone || !shipping.region || !shipping.address) {
    showToast(t("fillShipping"));
    return;
  }

  const order = {
    id: generateOrderId(),
    createdAt: new Date().toISOString(),
    status: window.I18N?.getLang() === "en" ? "Paid, awaiting shipment" : "已支付，待发货",
    payMethod,
    items: cart.map((i) => ({ ...i })),
    total: cartTotal(),
    shipping,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
  };

  const user = window.Auth?.currentUser?.();
  if (user) {
    order.userId = user.id;
    order.userEmail = user.email;
  }

  const orders = loadOrders();
  orders.unshift(order);
  saveOrders(orders);

  try {
    await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(order),
    });
  } catch (_) {
    /* ignore */
  }

  cart = [];
  saveCart();
  if (window.Warehouse) window.Warehouse.recordOrder(order);
  closeModal("checkoutModal");
  e.target.reset();

  document.getElementById("successBody").innerHTML = `
    <div class="success-box">
      <p>${escapeHtml(t("payOk", { method: payMethod }))}</p>
      <p class="order-id-label">${escapeHtml(t("saveOrderId"))}</p>
      <p class="order-id">${escapeHtml(order.id)}</p>
      <p class="success-tip">${escapeHtml(t("afterTip", { phone: shipping.phone }))}</p>
      <p class="success-addr">${escapeHtml(
        t("shipTo", { name: shipping.name, region: shipping.region, address: shipping.address })
      )}</p>
    </div>
  `;
  openModal("successModal");
  showToast(t("orderOk"));
}

function openLookup() {
  document.getElementById("lookupResult").hidden = true;
  document.getElementById("lookupResult").innerHTML = "";
  openModal("lookupModal");
}
window.openLookup = openLookup;

async function handleLookup(e) {
  e.preventDefault();
  const orderId = document.getElementById("lookupOrderId").value.trim().toUpperCase();
  const phone = normalizePhone(document.getElementById("lookupPhone").value);
  const result = document.getElementById("lookupResult");

  let order = loadOrders().find(
    (o) => o.id.toUpperCase() === orderId && normalizePhone(o.shipping.phone) === phone
  );

  if (!order) {
    try {
      const res = await fetch(
        `/api/orders?id=${encodeURIComponent(orderId)}&phone=${encodeURIComponent(phone)}`
      );
      const data = await res.json();
      if (data.ok && data.order) order = data.order;
    } catch (_) {
      /* ignore */
    }
  }

  if (!order) {
    result.hidden = false;
    result.innerHTML = `<p class="lookup-empty">${t("lookupEmpty")}</p>`;
    return;
  }

  const itemsHtml = order.items
    .map((i) => `<li>${escapeHtml(i.name)} × ${i.qty}　$${(i.price * i.qty).toFixed(2)}</li>`)
    .join("");

  const locale = window.I18N?.getLang() === "en" ? "en-US" : "zh-CN";
  result.hidden = false;
  result.innerHTML = `
    <div class="order-card">
      <div class="order-card-head">
        <strong>${escapeHtml(order.id)}</strong>
        <span>${escapeHtml(order.status)}</span>
      </div>
      <p>${t("orderTime")}${new Date(order.createdAt).toLocaleString(locale)}</p>
      <p>${t("payMethod")}${escapeHtml(order.payMethod)}</p>
      <p>${t("receiver")}${escapeHtml(order.shipping.name)} / ${escapeHtml(order.shipping.phone)}</p>
      <p>${t("address")}${escapeHtml(order.shipping.region)} ${escapeHtml(order.shipping.address)}</p>
      ${order.shipping.email ? `<p>${t("email")}${escapeHtml(order.shipping.email)}</p>` : ""}
      ${order.shipping.note ? `<p>${t("remark")}${escapeHtml(order.shipping.note)}</p>` : ""}
      <ul>${itemsHtml}</ul>
      <p class="order-total">${t("orderTotal")}${Number(order.total).toFixed(2)}</p>
    </div>
  `;
}

function handleContactSubmit() {}

function initNav() {
  const toggle = document.getElementById("menuToggle");
  const nav = document.getElementById("mainNav");
  toggle.addEventListener("click", () => nav.classList.toggle("open"));
  document.querySelectorAll("#mainNav a").forEach((link) => {
    link.addEventListener("click", () => nav.classList.remove("open"));
  });
}

function initSearchAndFilter() {
  document.getElementById("searchBtn").addEventListener("click", () => {
    searchKeyword = document.getElementById("searchInput").value;
    renderProducts();
    document.getElementById("products").scrollIntoView({ behavior: "smooth" });
  });
  document.getElementById("searchInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      searchKeyword = e.target.value;
      renderProducts();
      document.getElementById("products").scrollIntoView({ behavior: "smooth" });
    }
  });
  document.getElementById("categoryTabs").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-cat]");
    if (!btn) return;
    document.querySelectorAll("#categoryTabs button").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentCategory = btn.dataset.cat;
    renderProducts();
    if (currentCategory !== "all") {
      document.getElementById("products").scrollIntoView({ behavior: "smooth" });
    }
  });
}

function bindModalDismiss(overlayId) {
  document.getElementById(overlayId).addEventListener("click", (e) => {
    if (e.target.id === overlayId) closeModal(overlayId);
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  initLangSwitch();
  window.I18N.applyI18n();
  if (window.hydrateProducts) {
    products = await window.hydrateProducts();
  } else {
    products = window.PRODUCTS || [];
  }
  renderCategoryTabs();
  renderProducts();
  updateCartBadge();
  initNav();
  initSearchAndFilter();

  if (window.Auth) {
    window.Auth.initAuthUI({
      t,
      toast: showToast,
      onChange() {
        window.I18N.applyI18n();
        window.Auth.refreshAuthUI();
      },
    });
  }

  document.getElementById("cartBtn").addEventListener("click", openCart);
  document.getElementById("modalClose").addEventListener("click", () => closeModal("cartModal"));
  document.getElementById("goCheckoutBtn").addEventListener("click", openCheckout);
  document.getElementById("checkoutClose").addEventListener("click", () => closeModal("checkoutModal"));
  document.getElementById("checkoutForm").addEventListener("submit", submitOrder);
  document.getElementById("successClose").addEventListener("click", () => closeModal("successModal"));
  document.getElementById("successOk").addEventListener("click", () => closeModal("successModal"));

  document.getElementById("orderLookupBtn").addEventListener("click", openLookup);
  document.getElementById("footerOrderBtn").addEventListener("click", openLookup);
  document.getElementById("lookupClose").addEventListener("click", () => closeModal("lookupModal"));
  document.getElementById("lookupForm").addEventListener("submit", handleLookup);

  ["cartModal", "checkoutModal", "successModal", "lookupModal"].forEach(bindModalDismiss);

  window.addEventListener("message", (e) => {
    if (e.origin !== location.origin) return;
    if (e.data && e.data.type === "shr-open-lookup") openLookup();
  });
});

function initLangSwitch() {
  const wrap = document.getElementById("langSwitch");
  if (!wrap) return;
  const lang = window.I18N.getLang();
  wrap.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.lang === lang);
    btn.addEventListener("click", () => {
      window.I18N.setLang(btn.dataset.lang);
      wrap.querySelectorAll(".lang-btn").forEach((b) => b.classList.toggle("active", b.dataset.lang === btn.dataset.lang));
      window.I18N.applyI18n();
      if (window.Auth) window.Auth.refreshAuthUI();
      renderCategoryTabs();
      renderProducts();
      if (document.getElementById("cartModal").classList.contains("show")) renderCart();
      refreshChatWelcome();
      if (window.Warehouse && document.getElementById("warehouseModal") && document.getElementById("warehouseModal").classList.contains("show")) {
        window.Warehouse.open();
      }
    });
  });
}

function refreshChatWelcome() {
  if (window.SHRChat && window.SHRChat.onLangChange) window.SHRChat.onLangChange();
}

window.SHRCart = {
  get() {
    return cart;
  },
  set(next, meta) {
    cart = Array.isArray(next) ? next : [];
    saveCart(meta);
    if (document.getElementById("cartModal") && document.getElementById("cartModal").classList.contains("show")) {
      renderCart();
    }
  },
};
