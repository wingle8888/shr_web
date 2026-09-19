const products = window.PRODUCTS || [];

const CATEGORY_ORDER = [
  { id: "cat-mcu", name: "MCU 开发板", desc: "STM32 / Arduino 等高性能与入门 MCU 板卡" },
  { id: "cat-iot", name: "无线 IoT", desc: "Wi‑Fi / BLE 物联网模组与开发套件" },
  { id: "cat-sbc", name: "单板计算机", desc: "Raspberry Pi 等 Linux 单板机" },
  { id: "cat-display", name: "显示套件", desc: "触摸屏与 LVGL 人机界面方案" },
  { id: "cat-sensor", name: "传感器", desc: "姿态、环境等传感器模块" },
];

const CART_KEY = "shr_cart";
const ORDERS_KEY = "shr_orders";
const CHAT_STORAGE_KEY = "shr_chat_messages";
const WELCOME_MSG =
  "您好！我是开发板商城在线客服。可咨询商品、发货、订单查询（订单号+手机号）或售后问题。";

let cart = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
let currentCategory = "all";
let searchKeyword = "";

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
  return products.filter((p) => {
    const catOk = currentCategory === "all" || p.category === currentCategory;
    const q = searchKeyword.trim().toLowerCase();
    const searchOk =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.desc.toLowerCase().includes(q) ||
      p.tag.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q);
    return catOk && searchOk;
  });
}

function productCardHtml(p) {
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
        <button class="btn btn-sm" type="button" onclick="addToCart(${p.id})">加入购物车</button>
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
      const items = products.filter((p) => p.category === cat.name);
      if (items.length === 0) return "";
      return `
        <div class="category-block" id="${cat.id}">
          <div class="category-head">
            <div>
              <h3>${escapeHtml(cat.name)}</h3>
              <p>${escapeHtml(cat.desc)}</p>
            </div>
            <span class="category-count">${items.length} 款</span>
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
    grid.innerHTML = '<div class="empty-products">未找到相关商品，请换个关键词试试</div>';
    return;
  }
  grid.innerHTML = list.map(productCardHtml).join("");
}

function addToCart(id) {
  const product = products.find((p) => p.id === id);
  if (!product) return;
  const existing = cart.find((item) => item.id === id);
  if (existing) existing.qty += 1;
  else cart.push({ id: product.id, name: product.name, price: product.price, img: product.img, qty: 1 });
  saveCart();
  showToast(`已加入购物车：${product.name}`);
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
    body.innerHTML = '<div class="cart-empty">购物车是空的，去挑几块开发板吧</div>';
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
      <button class="cart-remove" type="button" onclick="removeFromCart(${item.id})">删除</button>
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
    showToast("购物车是空的");
    return;
  }
  closeModal("cartModal");
  document.getElementById("checkoutTotal").textContent = cartTotal().toFixed(2);
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
    showToast("购物车是空的");
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
    showToast("请完整填写收货信息");
    return;
  }

  const order = {
    id: generateOrderId(),
    createdAt: new Date().toISOString(),
    status: "已支付，待发货",
    payMethod,
    items: cart.map((i) => ({ ...i })),
    total: cartTotal(),
    shipping,
  };

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
    /* 静态演示环境可忽略；本地仍有订单记录 */
  }

  cart = [];
  saveCart();
  closeModal("checkoutModal");
  e.target.reset();

  document.getElementById("successBody").innerHTML = `
    <div class="success-box">
      <p>支付成功（${escapeHtml(payMethod)}）</p>
      <p class="order-id-label">请保存您的订单号</p>
      <p class="order-id">${escapeHtml(order.id)}</p>
      <p class="success-tip">售后查询请使用：订单号 + 手机号（${escapeHtml(shipping.phone)}）</p>
      <p class="success-addr">收货：${escapeHtml(shipping.name)} · ${escapeHtml(shipping.region)} ${escapeHtml(shipping.address)}</p>
    </div>
  `;
  openModal("successModal");
  showToast("下单成功，请保存订单号");
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
    result.innerHTML =
      '<p class="lookup-empty">未找到订单。请核对订单号与下单手机号；订单保存在下单设备，换设备时请保留订单凭证。</p>';
    return;
  }

  const itemsHtml = order.items
    .map((i) => `<li>${escapeHtml(i.name)} × ${i.qty}　¥${(i.price * i.qty).toFixed(2)}</li>`)
    .join("");

  result.hidden = false;
  result.innerHTML = `
    <div class="order-card">
      <div class="order-card-head">
        <strong>${escapeHtml(order.id)}</strong>
        <span>${escapeHtml(order.status)}</span>
      </div>
      <p>下单时间：${new Date(order.createdAt).toLocaleString("zh-CN")}</p>
      <p>支付方式：${escapeHtml(order.payMethod)}</p>
      <p>收货人：${escapeHtml(order.shipping.name)} / ${escapeHtml(order.shipping.phone)}</p>
      <p>地址：${escapeHtml(order.shipping.region)} ${escapeHtml(order.shipping.address)}</p>
      ${order.shipping.email ? `<p>邮箱：${escapeHtml(order.shipping.email)}</p>` : ""}
      ${order.shipping.note ? `<p>备注：${escapeHtml(order.shipping.note)}</p>` : ""}
      <ul>${itemsHtml}</ul>
      <p class="order-total">合计：¥${Number(order.total).toFixed(2)}</p>
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
  renderProducts();
  updateCartBadge();
  initNav();
  initSearchAndFilter();
  initChat();

  document.getElementById("heroBtn").addEventListener("click", () => {
    document.getElementById("products").scrollIntoView({ behavior: "smooth" });
  });

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

/* ---------- 在线客服 ---------- */
function formatChatTime(date = new Date()) {
  return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
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
  const t = text.toLowerCase();
  if (/订单|查询|售后|质量/.test(t)) {
    return "免注册下单。查询请点顶部「订单查询」，输入订单号与下单手机号即可查看购买与收货记录。";
  }
  if (/价格|多少钱|报价|优惠|price/.test(t)) {
    return "价格以商品页标价为准，批量可议价。直接加购结算即可，无需注册。";
  }
  if (/发货|物流|快递|地址|shipping/.test(t)) {
    return "结算时请填写完整收货地址与手机号，现货一般 24 小时内发货。";
  }
  if (/支付|paypal|visa|付款/.test(t)) {
    return "支持 PayPal、Visa/Mastercard、Apple Pay、Google Pay。";
  }
  if (/注册|账号|登录/.test(t)) {
    return "本商城无需注册，游客填写收货信息即可购买；订单号+手机号可查询记录。";
  }
  if (/人工|微信|电话|客服/.test(t)) {
    return "可通过顶部在线客服咨询，或添加微信 shr_tech / 邮件 sales@shrtech.com。";
  }
  if (/你好|您好|hi|hello/.test(t)) {
    return "您好！想选哪款开发板？也可以直接告诉我项目需求。";
  }
  return "已收到。如需查单请用订单号+手机号；其他问题可继续描述。";
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
    pushMessage("bot", WELCOME_MSG);
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
    if (btn.dataset.q === "订单查询") {
      openLookup();
      return;
    }
    handleChatSend(btn.dataset.q);
  });
}
