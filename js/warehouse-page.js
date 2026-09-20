(function () {
  if (!document.body.classList.contains("warehouse-page")) return;

  let panel = "orders";
  let orderFilter = "all";
  let orders = [];
  let pollTimer = null;

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

  function toast(msg) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 2400);
  }

  function locale() {
    return window.I18N && window.I18N.getLang && window.I18N.getLang() === "en" ? "en-US" : "zh-CN";
  }

  function money(n) {
    return "$" + (Number(n) || 0).toFixed(2);
  }

  function stageOf(order) {
    return window.OrderStatus ? window.OrderStatus.stage(order) : "paid";
  }

  function stageLabel(order) {
    return window.OrderStatus ? window.OrderStatus.label(stageOf(order)) : String(order.status || "");
  }

  function warehouse() {
    return window.Warehouse && window.Warehouse.getCache ? window.Warehouse.getCache() : { cart: [], addresses: [], purchases: [] };
  }

  function showToastAnd(key) {
    toast(t(key));
  }

  const ICONS = {
    box: '<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5"/><path d="M12 13v8"/>',
    list: '<rect x="6" y="3" width="12" height="18" rx="2"/><path d="M9 7h6M9 11h6M9 15h4"/>',
    pin: '<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.2"/>',
    cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M3 4h2l2.2 11h11.3l1.8-7H7"/>',
    wallet: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><circle cx="16.5" cy="14.5" r="1.2"/>',
    truck: '<path d="M3 7h11v10H3z"/><path d="M14 11h4l3 3v3h-7z"/><circle cx="7" cy="18" r="1.6"/><circle cx="18" cy="18" r="1.6"/>',
    package: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/><path d="M8 6.5l8 4.5"/>',
    refund: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>',
    clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
    card: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/>',
    user: '<circle cx="12" cy="8" r="3.2"/><path d="M5 19c1.4-3 3.8-4.5 7-4.5S17.6 16 19 19"/>',
    mail: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 8l9 6 9-6"/>',
    phone: '<path d="M7 3h3l1.4 3.4-2 1.2a12 12 0 0 0 6 6l1.2-2L21 13v3a2 2 0 0 1-2 2A14 14 0 0 1 5 7a2 2 0 0 1 2-2z"/>',
    star: '<path d="M12 3.6l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16.8 7.2 18.5l.9-5.4L4.2 9.3l5.4-.8z"/>',
    check: '<path d="M20 6L9 17l-5-5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    empty: '<path d="M3 7h18l-2 12H5L3 7z"/><path d="M8 7V5a4 4 0 0 1 8 0v2"/>',
    edit: '<path d="M4 20h4l10-10-4-4L4 16v4z"/><path d="M14 6l4 4"/>',
    trash: '<path d="M4 7h16M9 7V5h6v2M8 7l1 12h6l1-12"/>',
  };

  function icon(name, cls) {
    return `<svg class="wh-ico${cls ? " " + cls : ""}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.box}</svg>`;
  }

  function renderProfile() {
    const user = window.Auth && window.Auth.currentUser ? window.Auth.currentUser() : null;
    const box = document.getElementById("whProfile");
    if (!box || !user) return;
    box.innerHTML = `
      <div class="warehouse-avatar">${escapeHtml(String(user.name || user.email || "?").slice(0, 1))}</div>
      <div class="warehouse-profile-meta">
        <strong>${escapeHtml(user.name || user.email || "")}</strong>
        <p>${icon("mail")}<span>${escapeHtml(user.email || "")}</span></p>
        ${user.phone ? `<p>${icon("phone")}<span>${escapeHtml(user.phone)}</span></p>` : ""}
      </div>`;
  }

  function setPanel(next) {
    panel = next || "orders";
    document.querySelectorAll("#whNav [data-wh-panel]").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-wh-panel") === panel);
    });
    document.getElementById("whOrdersPanel").hidden = panel !== "orders";
    document.getElementById("whAddressPanel").hidden = panel !== "addresses";
    document.getElementById("whCartPanel").hidden = panel !== "cart";
    render();
  }

  function counts() {
    return {
      all: orders.length,
      unpaid: orders.filter((o) => stageOf(o) === "unpaid").length,
      paid: orders.filter((o) => stageOf(o) === "paid").length,
      shipped: orders.filter((o) => stageOf(o) === "shipped").length,
      refund: orders.filter((o) => stageOf(o) === "refund").length,
    };
  }

  function renderNavCounts() {
    const n = counts();
    const map = {
      orders: n.all,
      addresses: (warehouse().addresses || []).length,
      cart: (warehouse().cart || []).length,
    };
    document.querySelectorAll("[data-wh-count]").forEach((el) => {
      el.textContent = String(map[el.getAttribute("data-wh-count")] || 0);
    });
  }

  function renderStats() {
    const n = counts();
    const box = document.getElementById("whStats");
    if (!box) return;
    const items = [
      ["unpaid", "warehouseUnpaid", n.unpaid, "wallet"],
      ["paid", "warehouseToShip", n.paid, "truck"],
      ["shipped", "warehouseToReceive", n.shipped, "package"],
      ["refund", "warehouseRefund", n.refund, "refund"],
    ];
    box.innerHTML = items
      .map(
        ([key, label, count, ico]) => `
      <button type="button" class="warehouse-stat warehouse-stat-${key}${orderFilter === key ? " active" : ""}" data-wh-filter="${key}">
        <span class="warehouse-stat-ico">${icon(ico)}</span>
        <strong class="warehouse-stat-num">${escapeHtml(count)}</strong>
        <span class="warehouse-stat-label">${escapeHtml(t(label))}</span>
      </button>`
      )
      .join("");
  }

  function renderTabs() {
    const wrap = document.getElementById("whOrderTabs");
    if (!wrap) return;
    const n = counts();
    const tabs = [
      ["all", "warehouseOrdersAll", n.all, "list"],
      ["unpaid", "warehouseUnpaid", n.unpaid, "wallet"],
      ["paid", "warehouseToShip", n.paid, "truck"],
      ["shipped", "warehouseToReceive", n.shipped, "package"],
      ["refund", "warehouseRefund", n.refund, "refund"],
    ];
    wrap.innerHTML = tabs
      .map(
        ([key, label, count, ico]) =>
          `<button type="button" class="${orderFilter === key ? "active" : ""}" data-wh-filter="${key}">${icon(
            ico
          )}<span>${escapeHtml(t(label))} (${count})</span></button>`
      )
      .join("");
  }

  function emptyText() {
    if (orderFilter === "unpaid") return t("warehouseEmptyUnpaid");
    if (orderFilter === "paid") return t("warehouseEmptyToShip");
    if (orderFilter === "shipped") return t("warehouseEmptyToReceive");
    if (orderFilter === "refund") return t("warehouseEmptyRefund");
    return t("warehouseEmptyPurchases");
  }

  function renderOrders() {
    renderStats();
    renderTabs();
    const list = document.getElementById("whOrderList");
    if (!list) return;
    const rows = orders.filter((order) => orderFilter === "all" || stageOf(order) === orderFilter);
    if (!rows.length) {
      list.innerHTML = `<div class="warehouse-empty">${icon("empty", "wh-ico-lg")}<p>${escapeHtml(emptyText())}</p></div>`;
      return;
    }
    list.innerHTML = rows
      .map((order) => {
        const st = stageOf(order);
        const ship = order.shipping || {};
        const items = (order.items || [])
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
        const when = order.createdAt ? new Date(order.createdAt).toLocaleString(locale()) : "";
        const actions = [];
        if (st === "shipped") {
          actions.push(
            `<button type="button" class="btn btn-sm warehouse-btn-ico" data-wh-receive="${escapeHtml(order.id)}">${icon(
              "check"
            )}<span>${escapeHtml(t("warehouseConfirmReceive"))}</span></button>`
          );
        }
        if (st === "paid" || st === "shipped") {
          actions.push(
            `<button type="button" class="link-btn warehouse-btn-ico" data-wh-refund="${escapeHtml(order.id)}">${icon(
              "refund"
            )}<span>${escapeHtml(t("warehouseRequestRefund"))}</span></button>`
          );
        }
        return `
          <article class="order-card warehouse-card">
            <div class="order-card-head">
              <strong>${icon("list")}<span>${escapeHtml(order.id)}</span></strong>
              <span class="warehouse-stage warehouse-stage-${st}">${icon(st === "paid" ? "truck" : st === "shipped" ? "package" : st === "refund" ? "refund" : st === "unpaid" ? "wallet" : "check")}${escapeHtml(stageLabel(order))}</span>
            </div>
            <div class="warehouse-meta">
              <p>${icon("clock")}<span>${escapeHtml(t("orderTime"))}${escapeHtml(when)}</span></p>
              ${order.payMethod ? `<p>${icon("card")}<span>${escapeHtml(t("payMethod"))}${escapeHtml(order.payMethod)}</span></p>` : ""}
              ${
                ship.name
                  ? `<p>${icon("user")}<span>${escapeHtml(t("receiver"))}${escapeHtml(ship.name)} / ${escapeHtml(ship.phone || "")}</span></p>`
                  : ""
              }
              ${
                ship.address
                  ? `<p>${icon("pin")}<span>${escapeHtml(t("address"))}${escapeHtml(ship.region || "")} ${escapeHtml(ship.address)}</span></p>`
                  : ""
              }
            </div>
            ${items}
            <p class="order-total">${escapeHtml(t("orderTotal"))}${Number(order.total || 0).toFixed(2)}</p>
            ${actions.length ? `<div class="warehouse-actions">${actions.join("")}</div>` : ""}
          </article>`;
      })
      .join("");
  }

  function renderAddresses() {
    const list = document.getElementById("whAddressList");
    if (!list) return;
    const addresses = warehouse().addresses || [];
    if (!addresses.length) {
      list.innerHTML = `<div class="warehouse-empty">${icon("pin", "wh-ico-lg")}<p>${escapeHtml(t("warehouseEmptyAddresses"))}</p></div>`;
      return;
    }
    list.innerHTML = addresses
      .map((addr) => {
        const id = escapeHtml(addr.id || "");
        return `
          <article class="order-card warehouse-card warehouse-address-card">
            <div class="warehouse-address-mark">${icon("pin")}</div>
            <div class="warehouse-address-body">
            <p>
              <strong>${escapeHtml(addr.name || "")}</strong> · ${escapeHtml(addr.phone || "")}
              ${addr.isDefault ? `<span class="warehouse-stage warehouse-stage-paid">${icon("star")}${escapeHtml(t("warehouseDefaultAddress"))}</span>` : ""}
            </p>
            <p>${escapeHtml(addr.region || "")} ${escapeHtml(addr.address || "")}</p>
            ${addr.zip ? `<p>${escapeHtml(addr.zip)}</p>` : ""}
            ${addr.email ? `<p>${icon("mail")}<span>${escapeHtml(addr.email)}</span></p>` : ""}
            ${addr.note ? `<p>${escapeHtml(addr.note)}</p>` : ""}
            <div class="warehouse-actions">
              ${
                addr.isDefault
                  ? ""
                  : `<button type="button" class="btn btn-sm warehouse-btn-ico" data-wh-default="${id}">${icon(
                      "star"
                    )}<span>${escapeHtml(t("warehouseSetDefault"))}</span></button>`
              }
              <button type="button" class="link-btn warehouse-btn-ico" data-wh-edit="${id}">${icon("edit")}<span>${escapeHtml(t("warehouseEditAddress"))}</span></button>
              <button type="button" class="link-btn warehouse-btn-ico" data-wh-del="${id}">${icon("trash")}<span>${escapeHtml(t("warehouseDeleteAddress"))}</span></button>
            </div>
            </div>
          </article>`;
      })
      .join("");
  }

  function renderCart() {
    const list = document.getElementById("whCartList");
    if (!list) return;
    const cart = warehouse().cart || [];
    if (!cart.length) {
      list.innerHTML = `<div class="warehouse-empty">${icon("cart", "wh-ico-lg")}<p>${escapeHtml(t("warehouseEmptyCart"))}</p></div>`;
      return;
    }
    const rows = cart
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
        <button class="cart-remove warehouse-btn-ico" type="button" data-wh-remove="${escapeHtml(item.id)}">${icon("trash")}<span>${escapeHtml(t("remove"))}</span></button>
      </div>`
      )
      .join("");
    const total = cart.reduce((sum, item) => sum + Number(item.price) * Number(item.qty), 0);
    list.innerHTML = `<div class="warehouse-card warehouse-cart-box">${rows}<p class="order-total">${escapeHtml(t("total"))}${total.toFixed(2)}</p></div>`;
  }

  function render() {
    if (window.I18N) window.I18N.applyI18n();
    renderProfile();
    renderNavCounts();
    if (panel === "addresses") renderAddresses();
    else if (panel === "cart") renderCart();
    else renderOrders();
  }

  function showAddressForm(addr) {
    const form = document.getElementById("whAddressForm");
    form.hidden = false;
    document.getElementById("whAddrId").value = (addr && addr.id) || "";
    document.getElementById("whAddrName").value = (addr && addr.name) || "";
    document.getElementById("whAddrPhone").value = (addr && addr.phone) || "";
    document.getElementById("whAddrEmail").value = (addr && addr.email) || "";
    document.getElementById("whAddrRegion").value = (addr && addr.region) || "";
    document.getElementById("whAddrZip").value = (addr && addr.zip) || "";
    document.getElementById("whAddrAddress").value = (addr && addr.address) || "";
    document.getElementById("whAddrNote").value = (addr && addr.note) || "";
    document.getElementById("whAddrDefault").checked = !!(addr && addr.isDefault) || !(warehouse().addresses || []).length;
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function hideAddressForm() {
    const form = document.getElementById("whAddressForm");
    form.hidden = true;
    form.reset();
    document.getElementById("whAddrId").value = "";
  }

  async function refreshOrders(silent) {
    if (!window.Warehouse || typeof window.Warehouse.fetchOrders !== "function") return;
    try {
      const next = await window.Warehouse.fetchOrders();
      if (Array.isArray(next)) orders = next;
      if (!silent || panel === "orders") renderOrders();
    } catch (_) {}
  }

  async function orderAction(action, id) {
    if (!window.Warehouse || typeof window.Warehouse.updateOrder !== "function") return;
    try {
      const order = await window.Warehouse.updateOrder(action, id);
      if (order) {
        orders = orders.map((row) => (String(row.id) === String(order.id) ? order : row));
        renderOrders();
        showToastAnd(action === "receive" ? "warehouseReceivedOk" : "warehouseRefundOk");
      }
    } catch (err) {
      toast(String(err.message || err));
    }
  }

  function bind() {
    document.getElementById("whNav").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-wh-panel]");
      if (!btn) return;
      hideAddressForm();
      setPanel(btn.getAttribute("data-wh-panel"));
    });
    document.getElementById("whStats").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-wh-filter]");
      if (!btn) return;
      orderFilter = btn.getAttribute("data-wh-filter") || "all";
      setPanel("orders");
    });
    document.getElementById("whOrderTabs").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-wh-filter]");
      if (!btn) return;
      orderFilter = btn.getAttribute("data-wh-filter") || "all";
      renderOrders();
    });
    document.getElementById("whOrderList").addEventListener("click", (e) => {
      const receive = e.target.closest("[data-wh-receive]");
      if (receive) {
        if (window.confirm(t("warehouseConfirmReceive"))) orderAction("receive", receive.getAttribute("data-wh-receive"));
        return;
      }
      const refund = e.target.closest("[data-wh-refund]");
      if (refund && window.confirm(t("warehouseRequestRefund"))) {
        orderAction("refund", refund.getAttribute("data-wh-refund"));
      }
    });
    document.getElementById("whAddAddress").addEventListener("click", () => showAddressForm(null));
    document.getElementById("whAddrCancel").addEventListener("click", hideAddressForm);
    document.getElementById("whAddressForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const addr = {
        id: document.getElementById("whAddrId").value || `a${Date.now()}`,
        name: document.getElementById("whAddrName").value.trim(),
        phone: document.getElementById("whAddrPhone").value.trim(),
        email: document.getElementById("whAddrEmail").value.trim(),
        region: document.getElementById("whAddrRegion").value.trim(),
        zip: document.getElementById("whAddrZip").value.trim(),
        address: document.getElementById("whAddrAddress").value.trim(),
        note: document.getElementById("whAddrNote").value.trim(),
        isDefault: document.getElementById("whAddrDefault").checked,
      };
      await window.Warehouse.saveAddress(addr);
      hideAddressForm();
      renderAddresses();
      showToastAnd("warehouseAddressSaved");
    });
    document.getElementById("whAddressList").addEventListener("click", async (e) => {
      const edit = e.target.closest("[data-wh-edit]");
      const del = e.target.closest("[data-wh-del]");
      const def = e.target.closest("[data-wh-default]");
      if (edit) {
        const addr = (warehouse().addresses || []).find((a) => String(a.id) === String(edit.getAttribute("data-wh-edit")));
        showAddressForm(addr);
        return;
      }
      if (del) {
        if (!window.confirm(t("warehouseDeleteAddressConfirm"))) return;
        await window.Warehouse.removeAddress(del.getAttribute("data-wh-del"));
        renderAddresses();
        return;
      }
      if (def) {
        await window.Warehouse.setDefaultAddress(def.getAttribute("data-wh-default"));
        renderAddresses();
      }
    });
    document.getElementById("whCartList").addEventListener("click", (e) => {
      const qty = e.target.closest("[data-wh-qty]");
      const rm = e.target.closest("[data-wh-remove]");
      if (qty) window.Warehouse.changeQty(qty.getAttribute("data-wh-id"), Number(qty.getAttribute("data-wh-qty")));
      if (rm) window.Warehouse.changeQty(rm.getAttribute("data-wh-remove"), -999);
      renderCart();
    });
    const wrap = document.getElementById("langSwitch");
    if (wrap) {
      const lang = window.I18N.getLang();
      wrap.querySelectorAll(".lang-btn").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.lang === lang);
        btn.addEventListener("click", () => {
          window.I18N.setLang(btn.dataset.lang);
          wrap.querySelectorAll(".lang-btn").forEach((b) => b.classList.toggle("active", b.dataset.lang === btn.dataset.lang));
          render();
        });
      });
    }
  }

  function startPoll() {
    clearInterval(pollTimer);
    pollTimer = setInterval(() => {
      if (document.hidden || panel !== "orders") return;
      refreshOrders(true);
    }, 8000);
  }

  async function boot() {
    if (!window.Auth) return;
    await window.Auth.syncSession();
    if (!window.Auth.currentUser()) {
      location.replace("/?auth=login");
      return;
    }
    window.Auth.initAuthUI({
      t,
      toast,
      onChange(user) {
        if (!user) location.replace("/?auth=login");
      },
    });
    bind();
    if (window.Warehouse) await window.Warehouse.onAuthChange();
    await refreshOrders();
    render();
    startPoll();
  }

  window.WarehousePage = {
    refresh: async () => {
      if (window.Warehouse) await window.Warehouse.load(true);
      await refreshOrders();
      render();
    },
    render,
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
