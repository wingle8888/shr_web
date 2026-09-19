const products = [
  {
    id: 1,
    name: "STM32H750 开发板",
    desc: "480MHz Cortex-M7，1MB Flash，外置 SDRAM，适合高性能嵌入式应用",
    price: 189,
    tag: "热卖",
    img: "/images/stm32.jpg",
  },
  {
    id: 2,
    name: "ESP32-S3 开发套件",
    desc: "WiFi + BLE 5.0，双核 240MHz，内置 AI 加速，IoT 首选",
    price: 68,
    tag: "推荐",
    img: "/images/esp32.jpg",
  },
  {
    id: 3,
    name: "Raspberry Pi 5 主板",
    desc: "博通 BCM2712 四核 2.4GHz，8GB RAM，PCIe 2.0 接口",
    price: 599,
    tag: "新品",
    img: "/images/rpi5.jpg",
  },
  {
    id: 4,
    name: "LVGL 触摸屏套件",
    desc: "4.3 寸 IPS 电容屏 + STM32F429，预装 LVGL 图形库 Demo",
    price: 258,
    tag: "套装",
    img: "/images/lvgl.jpg",
  },
  {
    id: 5,
    name: "MPU6050 传感器模块",
    desc: "六轴陀螺仪 + 加速度计，I2C 接口，姿态检测必备",
    price: 12,
    tag: "传感器",
    img: "/images/mpu6050.jpg",
  },
  {
    id: 6,
    name: "Arduino UNO R4 WiFi",
    desc: "Renesas RA4M1 芯片，内置 WiFi，兼容 Arduino 生态",
    price: 145,
    tag: "入门",
    img: "/images/arduino.jpg",
  },
];

let cart = JSON.parse(localStorage.getItem("shr_cart") || "[]");

function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2500);
}

function saveCart() {
  localStorage.setItem("shr_cart", JSON.stringify(cart));
  updateCartBadge();
}

function updateCartBadge() {
  const badge = document.getElementById("cartBadge");
  const count = cart.reduce((sum, item) => sum + item.qty, 0);
  badge.textContent = count;
  badge.style.display = count > 0 ? "inline-flex" : "none";
}

function renderProducts() {
  const grid = document.getElementById("productsGrid");
  grid.innerHTML = products
    .map(
      (p) => `
    <div class="card">
      <img src="${p.img}" alt="${p.name}" loading="lazy">
      <div class="card-body">
        <span class="card-tag">${p.tag}</span>
        <h3>${p.name}</h3>
        <p class="card-desc">${p.desc}</p>
        <div class="card-price"><small>¥</small>${p.price}</div>
        <div class="card-actions">
          <button class="btn" onclick="addToCart(${p.id})">加入购物车</button>
          <button class="btn btn-outline card-inquiry" onclick="handleInquiry('${p.name}')">咨询采购</button>
        </div>
      </div>
    </div>
  `
    )
    .join("");
}

function addToCart(id) {
  const product = products.find((p) => p.id === id);
  if (!product) return;
  const existing = cart.find((item) => item.id === id);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ id: product.id, name: product.name, price: product.price, img: product.img, qty: 1 });
  }
  saveCart();
  showToast(`已加入购物车：${product.name}`);
}

function removeFromCart(id) {
  cart = cart.filter((item) => item.id !== id);
  saveCart();
  renderCart();
}

function renderCart() {
  const body = document.getElementById("cartBody");
  const totalEl = document.getElementById("cartTotal");
  if (cart.length === 0) {
    body.innerHTML = '<div class="cart-empty">购物车是空的，去挑选开发板吧</div>';
    totalEl.textContent = "0.00";
    return;
  }
  body.innerHTML = cart
    .map(
      (item) => `
    <div class="cart-item">
      <img src="${item.img}" alt="${item.name}">
      <div class="cart-item-info">
        <div class="cart-item-title">${item.name}</div>
        <div class="cart-item-price">¥${item.price} × ${item.qty}</div>
      </div>
      <button class="cart-remove" type="button" onclick="removeFromCart(${item.id})">移除</button>
    </div>
  `
    )
    .join("");
  const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  totalEl.textContent = total.toFixed(2);
}

function openCart() {
  renderCart();
  document.getElementById("cartModal").classList.add("show");
}

function closeCart() {
  document.getElementById("cartModal").classList.remove("show");
}

function handleInquiry(productName) {
  showToast(`已记录您对「${productName}」的咨询，我们将尽快联系您！`);
  document.getElementById("contact").scrollIntoView({ behavior: "smooth" });
}

function handleContactSubmit(e) {
  e.preventDefault();
  const name = document.getElementById("formName").value.trim();
  showToast(`感谢 ${name || "您"} 的留言，我们会尽快回复！`);
  e.target.reset();
}

function initNav() {
  const toggle = document.getElementById("menuToggle");
  const nav = document.getElementById("mainNav");

  toggle.addEventListener("click", () => nav.classList.toggle("open"));

  document.querySelectorAll("nav a").forEach((link) => {
    link.addEventListener("click", () => nav.classList.remove("open"));
  });

  const sections = document.querySelectorAll("section[id]");
  const navLinks = document.querySelectorAll("nav a");

  window.addEventListener("scroll", () => {
    let current = "";
    sections.forEach((section) => {
      if (window.scrollY >= section.offsetTop - 100) {
        current = section.id;
      }
    });
    navLinks.forEach((link) => {
      link.classList.toggle("active", link.getAttribute("href") === `#${current}`);
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  renderProducts();
  updateCartBadge();
  initNav();

  document.getElementById("contactForm").addEventListener("submit", handleContactSubmit);

  document.getElementById("heroBtn").addEventListener("click", () => {
    document.getElementById("products").scrollIntoView({ behavior: "smooth" });
  });

  document.getElementById("headerCta").addEventListener("click", () => {
    document.getElementById("contact").scrollIntoView({ behavior: "smooth" });
  });

  document.getElementById("cartBtn").addEventListener("click", openCart);
  document.getElementById("modalClose").addEventListener("click", closeCart);
  document.getElementById("cartModal").addEventListener("click", (e) => {
    if (e.target.id === "cartModal") closeCart();
  });

  document.getElementById("checkoutBtn").addEventListener("click", () => {
    if (cart.length === 0) {
      showToast("购物车是空的");
      return;
    }
    const method = document.querySelector('input[name="payMethod"]:checked')?.value || "PayPal";
    showToast(`已通过 ${method} 支付成功！感谢购买`);
    cart = [];
    saveCart();
    closeCart();
  });

  initChat();
});

/* ---------- 在线客服聊天 ---------- */
const CHAT_STORAGE_KEY = "shr_chat_messages";
const WELCOME_MSG =
  "您好！我是开发板商城在线客服。可咨询产品选型、价格、发货或技术支持，也可点击下方快捷问题。";

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

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getBotReply(text) {
  const t = text.toLowerCase();
  if (/价格|多少钱|报价|优惠|discount|price/.test(t)) {
    return "产品价格以页面标价为准，批量采购可享优惠。请告知型号与数量，或留下邮箱/微信，我们发送正式报价。";
  }
  if (/发货|物流|快递|运费|到货|shipping/.test(t)) {
    return "现货一般 24 小时内发货，支持国内快递与国际物流。下单后可在订单信息中查看物流单号。";
  }
  if (/技术|调试|固件|驱动|文档|sdk|支持/.test(t)) {
    return "我们提供选型指导、资料包和基础调试协助。请说明芯片型号与遇到的问题，工程师会跟进。";
  }
  if (/支付|paypal|visa|付款|国际/.test(t)) {
    return "支持 PayPal、Visa/Mastercard、Apple Pay、Google Pay 等国际支付方式，结算时可在购物车中选择。";
  }
  if (/人工|微信|电话|联系|客服/.test(t)) {
    return "可添加微信 shr_tech，或发邮件至 sales@shrtech.com。也可点击页面「联系我们」提交需求，我们会尽快回电。";
  }
  if (/你好|您好|hi|hello/.test(t)) {
    return "您好！请问需要了解哪款开发板或模块？也可以直接告诉我项目需求。";
  }
  return "已收到您的消息。客服会尽快处理；紧急需求请留言联系方式，或前往「联系我们」提交详细需求。";
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
  const panel = document.getElementById("chatPanel");
  panel.hidden = false;
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
  const closeBtn = document.getElementById("chatClose");
  const form = document.getElementById("chatForm");
  const input = document.getElementById("chatInput");
  const unread = document.getElementById("chatUnread");

  renderChatHistory();
  if (loadChatHistory().length <= 1) {
    unread.style.display = "inline-flex";
  }

  launcher.addEventListener("click", () => {
    const panel = document.getElementById("chatPanel");
    if (panel.hidden) openChat();
    else closeChat();
  });
  closeBtn.addEventListener("click", closeChat);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    handleChatSend(input.value);
    input.value = "";
  });

  document.getElementById("chatQuick").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-q]");
    if (!btn) return;
    handleChatSend(btn.dataset.q);
  });
}
