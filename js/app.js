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
});
