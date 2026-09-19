const CART_KEY = "shr_cart";
let cart = JSON.parse(localStorage.getItem(CART_KEY) || "[]");

function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2500);
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

function addToCart(id, qty = 1) {
  const product = window.getProductById(id);
  if (!product) return;
  const existing = cart.find((item) => item.id === product.id);
  if (existing) existing.qty += qty;
  else
    cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      img: product.img,
      qty,
    });
  saveCart();
  showToast(`已加入购物车：${product.name}`);
  renderCart();
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
  if (!body) return;
  if (cart.length === 0) {
    body.innerHTML = '<div class="cart-empty">购物车是空的</div>';
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

function renderDetail(product) {
  const main = document.getElementById("detailMain");
  document.title = `${product.name} - 开发板商城`;

  const features = (product.features || []).map((f) => `<li>${escapeHtml(f)}</li>`).join("");
  const specs = (product.specs || [])
    .map(
      ([k, v]) =>
        `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(v)}</td></tr>`
    )
    .join("");
  const pins = (product.pins || [])
    .map(
      ([pin, func, note]) =>
        `<tr><td>${escapeHtml(pin)}</td><td>${escapeHtml(func)}</td><td>${escapeHtml(note)}</td></tr>`
    )
    .join("");
  const pack = (product.package || []).map((p) => `<li>${escapeHtml(p)}</li>`).join("");

  main.innerHTML = `
    <nav class="breadcrumb">
      <a href="/">首页</a>
      <span>/</span>
      <a href="/#products">全部商品</a>
      <span>/</span>
      <span>${escapeHtml(product.name)}</span>
    </nav>

    <section class="detail-hero">
      <div class="detail-gallery">
        <img src="${product.img}" alt="${escapeHtml(product.name)}">
        <span class="card-tag">${escapeHtml(product.tag)}</span>
      </div>
      <div class="detail-buy">
        <p class="detail-cat">${escapeHtml(product.category)}</p>
        <h1>${escapeHtml(product.name)}</h1>
        <p class="detail-brief">${escapeHtml(product.desc)}</p>
        <div class="detail-price"><small>¥</small>${product.price}</div>
        <div class="detail-qty-buy">
          <label>
            数量
            <input type="number" id="buyQty" min="1" max="99" value="1">
          </label>
          <button class="btn" type="button" id="detailAddCart">加入购物车</button>
          <button class="btn btn-outline-orange" type="button" id="detailBuyNow">立即购买</button>
        </div>
        <p class="detail-ship-tip">免注册购买 · 结算时填写收货地址 · 订单号可查</p>
      </div>
    </section>

    <section class="detail-tabs-section">
      <div class="detail-tabs" id="detailTabs">
        <button type="button" class="active" data-tab="intro">产品介绍</button>
        <button type="button" data-tab="features">功能特点</button>
        <button type="button" data-tab="specs">规格参数</button>
        <button type="button" data-tab="pins">引脚定义</button>
        <button type="button" data-tab="package">包装清单</button>
      </div>

      <div class="detail-panels">
        <article class="detail-panel active" id="tab-intro">
          <h2>产品介绍</h2>
          <p>${escapeHtml(product.intro || product.desc)}</p>
        </article>
        <article class="detail-panel" id="tab-features">
          <h2>功能特点</h2>
          <ul class="feature-list">${features}</ul>
        </article>
        <article class="detail-panel" id="tab-specs">
          <h2>规格参数</h2>
          <table class="spec-table">
            <tbody>${specs}</tbody>
          </table>
        </article>
        <article class="detail-panel" id="tab-pins">
          <h2>引脚定义</h2>
          <p class="pin-note">下表为常用/典型引脚说明，实际丝印与原理图请以随货资料为准。</p>
          <div class="table-scroll">
            <table class="pin-table">
              <thead>
                <tr><th>引脚</th><th>功能</th><th>说明</th></tr>
              </thead>
              <tbody>${pins}</tbody>
            </table>
          </div>
        </article>
        <article class="detail-panel" id="tab-package">
          <h2>包装清单</h2>
          <ul class="feature-list">${pack}</ul>
        </article>
      </div>
    </section>
  `;

  document.getElementById("detailTabs").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-tab]");
    if (!btn) return;
    document.querySelectorAll("#detailTabs button").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".detail-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
  });

  document.getElementById("detailAddCart").addEventListener("click", () => {
    const qty = Math.max(1, parseInt(document.getElementById("buyQty").value, 10) || 1);
    addToCart(product.id, qty);
  });

  document.getElementById("detailBuyNow").addEventListener("click", () => {
    const qty = Math.max(1, parseInt(document.getElementById("buyQty").value, 10) || 1);
    addToCart(product.id, qty);
    location.href = "/#products";
    showToast("已加入购物车，请点击顶部购物车结算");
  });
}

document.addEventListener("DOMContentLoaded", () => {
  updateCartBadge();
  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  const product = window.getProductById(id);

  if (!product) {
    document.getElementById("detailMain").innerHTML = `
      <div class="detail-empty">
        <h1>未找到该商品</h1>
        <a class="btn" href="/#products">返回商城</a>
      </div>
    `;
    return;
  }

  renderDetail(product);

  document.getElementById("cartBtn").addEventListener("click", () => {
    renderCart();
    document.getElementById("cartModal").classList.add("show");
  });
  document.getElementById("modalClose").addEventListener("click", () => {
    document.getElementById("cartModal").classList.remove("show");
  });
  document.getElementById("cartModal").addEventListener("click", (e) => {
    if (e.target.id === "cartModal") document.getElementById("cartModal").classList.remove("show");
  });
});
