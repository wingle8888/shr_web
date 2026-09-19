const products = window.PRODUCTS || [];

const CATEGORY_ORDER = [
  { id: "cat-mcu", nameKey: "catMcu", descKey: "catMcuDesc" },
  { id: "cat-iot", nameKey: "catIot", descKey: "catIotDesc" },
  { id: "cat-sbc", nameKey: "catSbc", descKey: "catSbcDesc" },
  { id: "cat-display", nameKey: "catDisplay", descKey: "catDisplayDesc" },
  { id: "cat-sensor", nameKey: "catSensor", descKey: "catSensorDesc" },
];

const CART_KEY = "shr_cart";
const ORDERS_KEY = "shr_orders";
const CHAT_STORAGE_KEY = "shr_chat_messages";

let cart = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
let currentCategory = "all";
let searchKeyword = "";

function t(key, vars) {
  return window.I18N ? window.I18N.t(key, vars) : key;
}

function locProduct(p) {
  return window.getLocalizedProduct ? window.getLocalizedProduct(p) : p;
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

function saveCart() {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartBadge();
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
        <div class="card-price"><small>¥</small>${p.price}</div>
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
    sectionsEl.innerHTML = CATEGORY_ORDER.map((cat) => {
      const items = products.filter((p) => p.categoryId === cat.id);
      if (items.length === 0) return "";
      return `
        <div class="category-block" id="${cat.id}">
          <div class="category-head">
            <div>
              <h3>${escapeHtml(t(cat.nameKey))}</h3>
              <p>${escapeHtml(t(cat.descKey))}</p>
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
        <div class="cart-item-price">¥${item.price}</div>
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
    .map((i) => `<li>${escapeHtml(i.name)} × ${i.qty}　¥${(i.price * i.qty).toFixed(2)}</li>`)
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

document.addEventListener("DOMContentLoaded", () => {
  initLangSwitch();
  window.I18N.applyI18n();
  renderProducts();
  updateCartBadge();
  initNav();
  initSearchAndFilter();
  initChat();

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
      renderProducts();
      if (document.getElementById("cartModal").classList.contains("show")) renderCart();
      refreshChatWelcome();
    });
  });
}

function refreshChatWelcome() {
  const messages = loadChatHistory();
  if (messages.length <= 1) {
    localStorage.removeItem(CHAT_STORAGE_KEY);
    renderChatHistory();
  }
}

/* ---------- 在线客服 ---------- */
function formatChatTime(date = new Date()) {
  const locale = window.I18N?.getLang() === "en" ? "en-US" : "zh-CN";
  return date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

function loadChatHistory() {
  try {
    return JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveChatHistory(messages) {
  localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages.slice(-40)));
}

function appendChatBubble(role, text, time) {
  const box = document.getElementById("chatMessages");
  const el = document.createElement("div");
  el.className = `chat-bubble ${role}`;
  el.innerHTML = `${escapeHtml(text)}<div class="chat-time">${time || formatChatTime()}</div>`;
  box.appendChild(el);
  box.scrollTop = box.scrollHeight;
}

function getBotReply(text) {
  const raw = text.toLowerCase();
  if (raw === "order" || /订单|查询|售后|质量|lookup|order/.test(raw)) return t("botOrder");
  if (raw === "price" || /价格|多少钱|报价|优惠|price/.test(raw)) return t("botPrice");
  if (raw === "ship" || /发货|物流|快递|地址|shipping/.test(raw)) return t("botShip");
  if (/支付|paypal|visa|付款|pay/.test(raw)) return t("botPay");
  if (/注册|账号|登录|register|account|login/.test(raw)) return t("botReg");
  if (raw === "human" || /人工|微信|电话|客服|agent|support/.test(raw)) return t("botHuman");
  if (/你好|您好|hi|hello/.test(raw)) return t("botHi");
  return t("botDefault");
}

function pushMessage(role, text) {
  const messages = loadChatHistory();
  const item = { role, text, time: formatChatTime() };
  messages.push(item);
  saveChatHistory(messages);
  appendChatBubble(role, text, item.time);
}

function renderChatHistory() {
  const box = document.getElementById("chatMessages");
  box.innerHTML = "";
  const messages = loadChatHistory();
  if (messages.length === 0) {
    pushMessage("bot", t("welcome"));
    return;
  }
  messages.forEach((m) => appendChatBubble(m.role, m.text, m.time));
}

function openChat() {
  document.getElementById("chatPanel").hidden = false;
  document.getElementById("chatUnread").style.display = "none";
  document.getElementById("chatInput").focus();
  const box = document.getElementById("chatMessages");
  box.scrollTop = box.scrollHeight;
}

function closeChat() {
  document.getElementById("chatPanel").hidden = true;
}

function handleChatSend(text) {
  const msg = text.trim();
  if (!msg) return;
  pushMessage("user", msg);
  setTimeout(() => pushMessage("bot", getBotReply(msg)), 450);
}

function initChat() {
  const launcher = document.getElementById("chatLauncher");
  const form = document.getElementById("chatForm");
  const input = document.getElementById("chatInput");
  const unread = document.getElementById("chatUnread");

  renderChatHistory();
  if (loadChatHistory().length <= 1) unread.style.display = "inline-flex";

  launcher.addEventListener("click", () => {
    const panel = document.getElementById("chatPanel");
    if (panel.hidden) openChat();
    else closeChat();
  });
  document.getElementById("chatClose").addEventListener("click", closeChat);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    handleChatSend(input.value);
    input.value = "";
  });
  document.getElementById("chatQuick").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-q]");
    if (!btn) return;
    if (btn.dataset.q === "order") {
      openLookup();
      return;
    }
    handleChatSend(btn.dataset.q);
  });
}
