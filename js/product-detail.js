const CART_KEY = "shr_cart";
let cart = JSON.parse(localStorage.getItem(CART_KEY) || "[]");

function t(key, vars) {
  return window.I18N ? window.I18N.t(key, vars) : key;
}

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
  showToast(t("addedCart", { name: product.name }));
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
    body.innerHTML = `<div class="cart-empty">${t("cartEmptyShort")}</div>`;
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

function downloadLabel(d) {
  const lang = window.I18N?.getLang?.() || "zh";
  if (lang === "en" && d.nameEn) return d.nameEn;
  return d.name || d.nameEn || d.file;
}

function renderDownloadsHtml(downloads) {
  if (!downloads.length) {
    return `<p class="pin-note">${escapeHtml(t("noDownloads"))}</p>`;
  }
  return `<ul class="download-list">${downloads
    .map(
      (d) => `
      <li>
        <div class="download-meta">
          <strong>${escapeHtml(downloadLabel(d))}</strong>
          <span class="download-format">${escapeHtml(d.format || "")}</span>
        </div>
        <a class="btn btn-sm download-btn" href="${escapeHtml(d.file)}" download>${escapeHtml(t("downloadBtn"))}</a>
      </li>`
    )
    .join("")}</ul>`;
}

async function fetchProductDownloads(productId) {
  try {
    const res = await fetch(`/api/downloads?productId=${encodeURIComponent(productId)}`);
    const data = await res.json();
    if (data.ok && Array.isArray(data.downloads)) return data.downloads;
  } catch (_) {}
  return null;
}

function renderDetail(product, remoteDownloads) {
  const main = document.getElementById("detailMain");
  document.title = `${product.name} - ${t("brand")}`;

  const features = (product.features || []).map((f) => `<li>${escapeHtml(f)}</li>`).join("");
  const specs = (product.specs || [])
    .map(([k, v]) => `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(v)}</td></tr>`)
    .join("");
  const pins = (product.pins || [])
    .map(
      ([pin, func, note]) =>
        `<tr><td>${escapeHtml(pin)}</td><td>${escapeHtml(func)}</td><td>${escapeHtml(note)}</td></tr>`
    )
    .join("");
  const pack = (product.package || []).map((p) => `<li>${escapeHtml(p)}</li>`).join("");
  const downloads = Array.isArray(remoteDownloads)
    ? remoteDownloads
    : product.downloads || [];
  const downloadsHtml = renderDownloadsHtml(downloads);

  main.innerHTML = `
    <nav class="breadcrumb">
      <a href="/">${escapeHtml(t("home"))}</a>
      <span>/</span>
      <a href="/#products">${escapeHtml(t("allProducts"))}</a>
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
            ${escapeHtml(t("qty"))}
            <input type="number" id="buyQty" min="1" max="99" value="1">
          </label>
          <button class="btn" type="button" id="detailAddCart">${escapeHtml(t("addToCart"))}</button>
          <button class="btn btn-outline-orange" type="button" id="detailBuyNow">${escapeHtml(t("buyNow"))}</button>
          ${
            downloads[0]
              ? `<a class="btn btn-sm download-btn-inline" href="${escapeHtml(downloads[0].file)}" download>${escapeHtml(t("downloads"))}</a>`
              : ""
          }
        </div>
        <p class="detail-ship-tip">${escapeHtml(t("shipTip"))}</p>
      </div>
    </section>

    <section class="detail-tabs-section">
      <div class="detail-tabs" id="detailTabs">
        <button type="button" class="active" data-tab="intro">${escapeHtml(t("intro"))}</button>
        <button type="button" data-tab="features">${escapeHtml(t("features"))}</button>
        <button type="button" data-tab="specs">${escapeHtml(t("specs"))}</button>
        <button type="button" data-tab="pins">${escapeHtml(t("pins"))}</button>
        <button type="button" data-tab="package">${escapeHtml(t("package"))}</button>
        <button type="button" data-tab="downloads">${escapeHtml(t("downloads"))}</button>
      </div>

      <div class="detail-panels">
        <article class="detail-panel active" id="tab-intro">
          <h2>${escapeHtml(t("intro"))}</h2>
          <p>${escapeHtml(product.intro || product.desc)}</p>
        </article>
        <article class="detail-panel" id="tab-features">
          <h2>${escapeHtml(t("features"))}</h2>
          <ul class="feature-list">${features}</ul>
        </article>
        <article class="detail-panel" id="tab-specs">
          <h2>${escapeHtml(t("specs"))}</h2>
          <table class="spec-table"><tbody>${specs}</tbody></table>
        </article>
        <article class="detail-panel" id="tab-pins">
          <h2>${escapeHtml(t("pins"))}</h2>
          <p class="pin-note">${escapeHtml(t("pinNote"))}</p>
          <div class="table-scroll">
            <table class="pin-table">
              <thead>
                <tr><th>${escapeHtml(t("pinCol"))}</th><th>${escapeHtml(t("funcCol"))}</th><th>${escapeHtml(t("noteCol"))}</th></tr>
              </thead>
              <tbody>${pins}</tbody>
            </table>
          </div>
        </article>
        <article class="detail-panel" id="tab-package">
          <h2>${escapeHtml(t("package"))}</h2>
          <ul class="feature-list">${pack}</ul>
        </article>
        <article class="detail-panel" id="tab-downloads">
          <h2>${escapeHtml(t("downloads"))}</h2>
          <p class="pin-note">${escapeHtml(t("downloadHint"))}</p>
          ${downloadsHtml}
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
    showToast(t("boughtHint"));
  });
}

async function loadCurrentProduct() {
  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  const product = window.getProductById(id);
  if (!product) {
    document.getElementById("detailMain").innerHTML = `
      <div class="detail-empty">
        <h1>${escapeHtml(t("notFound"))}</h1>
        <a class="btn" href="/#products">${escapeHtml(t("backToMall"))}</a>
      </div>
    `;
    return null;
  }
  const remote = await fetchProductDownloads(product.id);
  renderDetail(product, remote);
  return product;
}

function initLangSwitch() {
  const wrap = document.getElementById("langSwitch");
  if (!wrap) return;
  const lang = window.I18N.getLang();
  wrap.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.lang === lang);
    btn.addEventListener("click", async () => {
      window.I18N.setLang(btn.dataset.lang);
      wrap.querySelectorAll(".lang-btn").forEach((b) =>
        b.classList.toggle("active", b.dataset.lang === btn.dataset.lang)
      );
      window.I18N.applyI18n();
      if (window.Auth) window.Auth.refreshAuthUI();
      await loadCurrentProduct();
      if (document.getElementById("cartModal").classList.contains("show")) renderCart();
    });
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  initLangSwitch();
  window.I18N.applyI18n();
  updateCartBadge();
  if (window.hydrateProducts) await window.hydrateProducts();
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
  await loadCurrentProduct();

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
