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

  function renderProfile() {
    const user = window.Auth && window.Auth.currentUser ? window.Auth.currentUser() : null;
    const box = document.getElementById("whProfile");
    if (!box || !user) return;
    box.innerHTML = `
      <div class="warehouse-avatar">${escapeHtml(String(user.name || user.email || "?").slice(0, 1))}</div>
      <div>
        <strong>${escapeHtml(user.name || user.email || "")}</strong>
        <p>${escapeHtml(user.email || "")}</p>
        ${user.phone ? `<p>${escapeHtml(user.phone)}</p>` : ""}
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

  function renderStats() {
    const n = counts();
    const box = document.getElementById("whStats");
    if (!box) return;
    const items = [
      ["unpaid", "warehouseUnpaid", n.unpaid],
      ["paid", "warehouseToShip", n.paid],
      ["shipped", "warehouseToReceive", n.shipped],
      ["refund", "warehouseRefund", n.refund],
    ];
    box.innerHTML = items
      .map(
        ([key, label, count]) => `
      <button type="button" class="warehouse-stat${orderFilter === key ? " active" : ""}" data-wh-filter="${key}">
        <b>${escapeHtml(count)}</b>
        <span>${escapeHtml(t(label))}</span>
      </button>`
      )
      .join("");
  }

  function renderTabs() {
    const wrap = document.getElementById("whOrderTabs");
    if (!wrap) return;
    const n = counts();
    const tabs = [
      ["all", "warehouseOrdersAll", n.all],
      ["unpaid", "warehouseUnpaid", n.unpaid],
      ["paid", "warehouseToShip", n.paid],
      ["shipped", "warehouseToReceive", n.shipped],
      ["refund", "warehouseRefund", n.refund],
    ];
    wrap.innerHTML = tabs
      .map(
        ([key, label, count]) =>
          `<button type="button" class="${orderFilter === key ? "active" : ""}" data-wh-filter="${key}">${escapeHtml(
            t(label)
          )} (${count})</button>`
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
      list.innerHTML = `<div class="warehouse-empty">${escapeHtml(emptyText())}</div>`;
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
            `<button type="button" class="btn btn-sm" data-wh-receive="${escapeHtml(order.id)}">${escapeHtml(
              t("warehouseConfirmReceive")
            )}</button>`
          );
        }
        if (st === "paid" || st === "shipped") {
          actions.push(
            `<button type="button" class="link-btn" data-wh-refund="${escapeHtml(order.id)}">${escapeHtml(
              t("warehouseRequestRefund")
            )}</button>`
          );
        }
        return `
          <article class="order-card warehouse-card">
            <div class="order-card-head">
              <strong>${escapeHtml(order.id)}</strong>
              <span class="warehouse-stage warehouse-stage-${st}">${escapeHtml(stageLabel(order))}</span>
            </div>
            <p>${escapeHtml(t("orderTime"))}${escapeHtml(when)}</p>
            ${order.payMethod ? `<p>${escapeHtml(t("payMethod"))}${escapeHtml(order.payMethod)}</p>` : ""}
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
      list.innerHTML = `<div class="warehouse-empty">${escapeHtml(t("warehouseEmptyAddresses"))}</div>`;
      return;
    }
    list.innerHTML = addresses
      .map((addr) => {
        const id = escapeHtml(addr.id || "");
        return `
          <article class="order-card warehouse-card">
            <p>
              <strong>${escapeHtml(addr.name || "")}</strong> · ${escapeHtml(addr.phone || "")}
              ${addr.isDefault ? `<span class="warehouse-stage warehouse-stage-paid">${escapeHtml(t("warehouseDefaultAddress"))}</span>` : ""}
            </p>
            <p>${escapeHtml(addr.region || "")} ${escapeHtml(addr.address || "")}</p>
            ${addr.zip ? `<p>${escapeHtml(addr.zip)}</p>` : ""}
            ${addr.email ? `<p>${escapeHtml(addr.email)}</p>` : ""}
            ${addr.note ? `<p>${escapeHtml(addr.note)}</p>` : ""}
            <div class="warehouse-actions">
              ${
                addr.isDefault
                  ? ""
                  : `<button type="button" class="btn btn-sm" data-wh-default="${id}">${escapeHtml(
                      t("warehouseSetDefault")
                    )}</button>`
              }
              <button type="button" class="link-btn" data-wh-edit="${id}">${escapeHtml(t("warehouseEditAddress"))}</button>
              <button type="button" class="link-btn" data-wh-del="${id}">${escapeHtml(t("warehouseDeleteAddress"))}</button>
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
      list.innerHTML = `<div class="warehouse-empty">${escapeHtml(t("warehouseEmptyCart"))}</div>`;
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
        <button class="cart-remove" type="button" data-wh-remove="${escapeHtml(item.id)}">${escapeHtml(t("remove"))}</button>
      </div>`
      )
      .join("");
    const total = cart.reduce((sum, item) => sum + Number(item.price) * Number(item.qty), 0);
    list.innerHTML = `${rows}<p class="order-total">${escapeHtml(t("total"))}${total.toFixed(2)}</p>`;
  }

  function render() {
    if (window.I18N) window.I18N.applyI18n();
    renderProfile();
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
