const PASS_KEY = "shr_admin_pass";
const EDIT_KEY = "shr_admin_edit_product";
const ORDERS_KEY = "shr_orders";

const state = {
  seedProducts: [],
  customProducts: [],
  hiddenIds: [],
  deletedIds: [],
  galleries: {},
  galleryProductId: "",
  editGallery: [],
  editGalleryEn: [],
  editGalleryActive: false,
  categories: [],
  orders: [],
  customers: [],
  addressStats: [],
  geoStats: [],
  users: [],
  logins: [],
  usersStorage: "ephemeral",
  usersStorageOk: false,
  usersStorageMessage: "",
  stats: null,
  visits: null,
  currentTab: "dashboard",
  chatThreads: [],
  chatUnread: 0,
  activeChatVisitorId: "",
  chatThread: null,
  autoReply: { enabled: false, message: "" },
};

let dailyVisitChart = null;
let monthlyVisitChart = null;
let visitTimer = null;
let geoMap = null;
let geoMapTimer = null;

function $(id) {
  return document.getElementById(id);
}

let dialogResolve = null;

function closeAdminDialog(ok) {
  const overlay = $("adminDialog");
  if (overlay) overlay.hidden = true;
  const done = dialogResolve;
  dialogResolve = null;
  if (done) done(Boolean(ok));
}

function openAdminDialog({ title, message, okText, cancelText, showCancel }) {
  return new Promise((resolve) => {
    const overlay = $("adminDialog");
    if (!overlay) {
      resolve(window.confirm(message));
      return;
    }
    if (dialogResolve) dialogResolve(false);
    dialogResolve = resolve;
    const titleEl = $("adminDialogTitle");
    const msgEl = $("adminDialogMessage");
    const okBtn = $("adminDialogOk");
    const cancelBtn = $("adminDialogCancel");
    const withCancel = showCancel !== false;
    if (titleEl) titleEl.textContent = title || "请确认";
    if (msgEl) msgEl.textContent = message || "";
    if (okBtn) okBtn.textContent = okText || "确定";
    if (cancelBtn) {
      cancelBtn.textContent = cancelText || "取消";
      cancelBtn.hidden = !withCancel;
    }
    overlay.classList.toggle("is-alert", !withCancel);
    overlay.hidden = false;
    if (withCancel && cancelBtn) cancelBtn.focus();
    else if (okBtn) okBtn.focus();
  });
}

function adminConfirm(message, title) {
  return openAdminDialog({
    title: title || "请确认",
    message,
    okText: "确定",
    cancelText: "取消",
    showCancel: true,
  });
}

function adminAlert(message, title) {
  return openAdminDialog({
    title: title || "提示",
    message,
    okText: "确定",
    showCancel: false,
  });
}

function getPass() {
  return sessionStorage.getItem(PASS_KEY) || "";
}

function setPass(v) {
  sessionStorage.setItem(PASS_KEY, v);
}

function clearPass() {
  sessionStorage.removeItem(PASS_KEY);
}

function rememberEditProduct(id) {
  const value = String(id || "").trim();
  if (value) sessionStorage.setItem(EDIT_KEY, value);
  else sessionStorage.removeItem(EDIT_KEY);
}

function activeEditId() {
  const field = $("editProductId");
  const stored = sessionStorage.getItem(EDIT_KEY) || "";
  const current = field ? field.value.trim() : "";
  if (field && !current && stored) field.value = stored;
  return (field && field.value.trim()) || stored;
}

function syncEditMode() {
  const id = activeEditId();
  const btn = $("productSubmitBtn");
  if (btn) btn.textContent = id ? "保存修改" : "上传产品";
  const hint = $("editProductHint");
  if (!hint) return;
  if (!id) {
    hint.hidden = true;
    hint.textContent = "";
    return;
  }
  hint.hidden = false;
  hint.textContent = `正在修改 #${id}。保存会更新该产品，不会新建。若要上传新产品，请先点「清空表单」。`;
}

function pinFormDefaults() {
  const form = $("productForm");
  if (!form) return;
  form.querySelectorAll("input, textarea").forEach((el) => {
    if (el.type === "file") return;
    el.defaultValue = el.value;
  });
  form.querySelectorAll("select").forEach((sel) => {
    Array.from(sel.options).forEach((opt) => {
      opt.defaultSelected = opt.selected;
    });
  });
}

function clearFormDefaults() {
  const form = $("productForm");
  if (!form) return;
  form.querySelectorAll("input, textarea").forEach((el) => {
    if (el.type === "file") return;
    el.defaultValue = "";
  });
  form.querySelectorAll("select").forEach((sel) => {
    Array.from(sel.options).forEach((opt, index) => {
      opt.defaultSelected = index === 0;
    });
  });
}

function snapshotProductForm() {
  const form = $("productForm");
  if (!form) return null;
  const data = {};
  form.querySelectorAll("input, textarea, select").forEach((el) => {
    if (!el.id || el.type === "file") return;
    data[el.id] = el.value;
  });
  return data;
}

function restoreProductFormSnapshot(data) {
  if (!data) return;
  Object.keys(data).forEach((id) => {
    const el = $(id);
    if (!el || el.value === data[id]) return;
    el.value = data[id];
  });
}

function restoreProductEditor() {
  const editId = sessionStorage.getItem(EDIT_KEY) || "";
  if (!editId) return;
  if ($("editProductId").value.trim() === editId && $("prodName").value.trim()) {
    syncEditMode();
    return;
  }
  const product = allProducts().find((item) => String(item.id) === String(editId));
  if (!product) {
    syncEditMode();
    return;
  }
  fillProductForm(product);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatMoney(n) {
  return (Number(n) || 0).toFixed(2);
}

function formatSize(n) {
  if (!n && n !== 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function formatTime(iso) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("zh-CN");
  } catch {
    return String(iso);
  }
}

async function api(url, options = {}) {
  const headers = Object.assign({ "Content-Type": "application/json" }, options.headers || {});
  if (getPass()) headers["x-admin-password"] = getPass();
  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    const msg = String(data.error || `HTTP ${res.status}`);
    throw new Error(/RPC receiver|does not implement the method/i.test(msg) ? "下架名单未能写入云端，请稍后重试" : msg);
  }
  return data;
}

function hiddenSet() {
  return new Set((state.hiddenIds || []).map(String));
}

function allProducts() {
  const hidden = hiddenSet();
  const deleted = new Set((state.deletedIds || []).map(String));
  const map = new Map();
  state.seedProducts.forEach((p) => map.set(String(p.id), { ...p, source: "seed" }));
  state.customProducts.forEach((p) => map.set(String(p.id), { ...p, source: "custom" }));
  return Array.from(map.values())
    .filter((p) => !deleted.has(String(p.id)))
    .map((p) => ({
      ...p,
      hidden: hidden.has(String(p.id)),
      images: state.galleries[String(p.id)] || p.images || [],
    }))
    .sort((a, b) => Number(a.id) - Number(b.id));
}

function showPanel(loggedIn) {
  $("loginCard").hidden = loggedIn;
  $("panelCard").hidden = !loggedIn;
  $("logoutBtn").hidden = !loggedIn;
  if ($("passwordBtn")) $("passwordBtn").hidden = !loggedIn;
}

function switchTab(tab) {
  state.currentTab = tab;
  document.querySelectorAll(".admin-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });
  document.querySelectorAll(".admin-tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `tab-${tab}`);
  });
  if ((tab === "dashboard" || tab === "geo") && getPass()) {
    loadVisits().catch(() => {});
  }
  if (tab === "orders" && getPass()) {
    loadOrdersBundle().catch(() => {});
  }
  if (tab === "geo") {
    requestAnimationFrame(() => renderWorldMap());
  }
  if (tab === "logins" && getPass()) {
    loadLoginHistory().catch(() => {});
  }
  if (tab === "chat" && getPass()) {
    loadChatList().catch(() => {});
    startChatLive();
  } else {
    stopChatLive();
  }
}

function productOptions() {
  const sel = $("productId");
  if (!sel) return;
  const products = allProducts();
  sel.innerHTML = products
    .map((p) => `<option value="${p.id}">#${p.id} ${escapeHtml(p.name)}</option>`)
    .join("");
}

function fillCategorySelect(selectedId) {
  const sel = $("prodCategory");
  if (!sel) return;
  const cats = Array.isArray(state.categories) && state.categories.length ? state.categories : [];
  if (!cats.length) return;
  const current = selectedId || sel.value;
  sel.innerHTML = cats
    .map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`)
    .join("");
  if (current && cats.some((c) => c.id === current)) sel.value = current;
}

function renderCategoriesTable() {
  const tbody = $("categoriesTable") && $("categoriesTable").querySelector("tbody");
  if (!tbody) return;
  const cats = Array.isArray(state.categories) ? state.categories : [];
  const counts = new Map();
  allProducts().forEach((p) => {
    const key = String(p.categoryId || "");
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  tbody.innerHTML = cats.length
    ? cats
        .map((c) => {
          const n = counts.get(String(c.id)) || 0;
          const canDelete = cats.length > 1;
          return `<tr>
        <td>${escapeHtml(c.name)}</td>
        <td>${escapeHtml(c.desc || "-")}</td>
        <td>${n}</td>
        <td class="admin-row-actions">
          ${canDelete ? `<button type="button" class="danger" data-del-category="${escapeHtml(c.id)}">删除</button>` : `<span class="admin-hint">至少保留一个</span>`}
        </td>
      </tr>`;
        })
        .join("")
    : `<tr><td colspan="4" class="admin-empty">暂无分类</td></tr>`;
}

function renderStats() {
  const stats = state.stats || {
    totalOrders: 0,
    totalAmount: 0,
    thisMonth: { month: "-", orders: 0, amount: 0, items: 0 },
    monthly: [],
  };
  const tm = stats.thisMonth || {};
  const visits = state.visits || {
    today: { pv: 0, uv: 0 },
    thisMonth: { pv: 0, uv: 0 },
    totalPv: 0,
    totalUv: 0,
  };
  const today = visits.today || {};
  const monthV = visits.thisMonth || {};

  $("statsCards").innerHTML = `
    <div class="admin-stat-card">
      <div class="admin-stat-label">今日访问</div>
      <div class="admin-stat-value">${today.pv || 0}</div>
      <div class="admin-stat-sub">独立访客 ${today.uv || 0} · ${escapeHtml(today.day || "今日")}</div>
    </div>
    <div class="admin-stat-card">
      <div class="admin-stat-label">本月访问</div>
      <div class="admin-stat-value">${monthV.pv || 0}</div>
      <div class="admin-stat-sub">独立访客 ${monthV.uv || 0} · ${escapeHtml(monthV.month || "本月")}</div>
    </div>
    <div class="admin-stat-card">
      <div class="admin-stat-label">本月销售额</div>
      <div class="admin-stat-value">$${formatMoney(tm.amount)}</div>
      <div class="admin-stat-sub">${escapeHtml(tm.month || "-")} · 订单 ${tm.orders || 0}</div>
    </div>
    <div class="admin-stat-card">
      <div class="admin-stat-label">累计销售额</div>
      <div class="admin-stat-value">$${formatMoney(stats.totalAmount)}</div>
      <div class="admin-stat-sub">订单 ${stats.totalOrders || 0} · 客户 ${state.customers.length}</div>
    </div>
  `;

  const tbody = $("monthlyTable").querySelector("tbody");
  const rows = stats.monthly || [];
  tbody.innerHTML = rows.length
    ? rows
        .map(
          (m) => `<tr>
        <td>${escapeHtml(m.month)}</td>
        <td>${m.orders}</td>
        <td>${m.items}</td>
        <td>$${formatMoney(m.amount)}</td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="4" class="admin-empty">暂无销售数据</td></tr>`;

  renderVisitCharts();
  markVisitUpdated();
}

function chartDefaults() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: "#9fb3c8", boxWidth: 12, font: { size: 12 } },
      },
    },
    scales: {
      x: {
        ticks: { color: "#7f93a8", maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
        grid: { color: "rgba(46, 230, 255, 0.08)" },
      },
      y: {
        beginAtZero: true,
        ticks: { color: "#7f93a8", precision: 0 },
        grid: { color: "rgba(46, 230, 255, 0.08)" },
      },
    },
  };
}

function renderVisitCharts() {
  try {
    if (typeof Chart === "undefined") return;
    const visits = state.visits || { daily: [], monthly: [] };
    const daily = visits.daily || [];
    const monthly = visits.monthly || [];

    const dailyLabels = daily.map((d) => String(d.day).slice(5));
    const monthlyLabels = monthly.map((m) => m.month);

    const dailyCfg = {
      type: "line",
      data: {
        labels: dailyLabels.length ? dailyLabels : ["暂无数据"],
        datasets: [
          {
            label: "日浏览",
            data: daily.length ? daily.map((d) => d.pv) : [0],
            borderColor: "#2ee6ff",
            backgroundColor: "rgba(46, 230, 255, 0.18)",
            fill: true,
            tension: 0.35,
            pointRadius: 2,
          },
          {
            label: "日访客",
            data: daily.length ? daily.map((d) => d.uv) : [0],
            borderColor: "#ff7a18",
            backgroundColor: "rgba(255, 122, 24, 0.12)",
            fill: false,
            tension: 0.35,
            pointRadius: 2,
          },
        ],
      },
      options: chartDefaults(),
    };

    const monthlyCfg = {
      type: "bar",
      data: {
        labels: monthlyLabels.length ? monthlyLabels : ["暂无数据"],
        datasets: [
          {
            label: "月浏览",
            data: monthly.length ? monthly.map((m) => m.pv) : [0],
            backgroundColor: "rgba(46, 230, 255, 0.55)",
            borderRadius: 6,
          },
          {
            label: "月访客",
            data: monthly.length ? monthly.map((m) => m.uv) : [0],
            backgroundColor: "rgba(255, 122, 24, 0.55)",
            borderRadius: 6,
          },
        ],
      },
      options: chartDefaults(),
    };

    const dailyCanvas = $("dailyVisitChart");
    const monthlyCanvas = $("monthlyVisitChart");
    if (!dailyCanvas || !monthlyCanvas) return;

    if (dailyVisitChart) dailyVisitChart.destroy();
    if (monthlyVisitChart) monthlyVisitChart.destroy();
    dailyVisitChart = new Chart(dailyCanvas, dailyCfg);
    monthlyVisitChart = new Chart(monthlyCanvas, monthlyCfg);
  } catch (_) {
    /* 图表失败不影响数据总览其它内容 */
  }
}

function orderStage(order) {
  const s = String((order && order.status) || "");
  if (/退款|售后|refund/i.test(s)) return "refund";
  if (/待付款|未支付|unpaid|pending payment|awaiting payment/i.test(s)) return "unpaid";
  if (/已签收|已完成|received|delivered|completed/i.test(s) && !/待收货/.test(s)) return "received";
  if (/待收货|已发货|shipped|in transit/i.test(s)) return "shipped";
  if (/待发货|已支付|paid|awaiting shipment/i.test(s)) return "paid";
  return "paid";
}

function cancelledOrder(order) {
  return orderStage(order) === "refund";
}

function orderStatusText(order) {
  return String((order && order.status) || "");
}

function isShippedOrder(order) {
  const stage = orderStage(order);
  return stage === "shipped" || stage === "received";
}

function needsShipping(order) {
  return orderStage(order) === "paid";
}

function awaitingReceive(order) {
  return orderStage(order) === "shipped";
}

function shippedStatusFor() {
  return "已发货，待收货";
}

function stageLabel(order) {
  return (
    {
      unpaid: "待付款",
      paid: "待发货",
      shipped: "待收货",
      received: "已签收",
      refund: "退款/售后",
    }[orderStage(order)] || "待发货"
  );
}

function pendingShipOrders() {
  return (state.orders || []).filter(needsShipping);
}

function updateOrdersBadge() {
  const badge = $("ordersTabBadge");
  if (!badge) return;
  const n = pendingShipOrders().length;
  badge.hidden = n <= 0;
  badge.textContent = n > 99 ? "99+" : String(n);
}

function renderShipAlert() {
  const box = $("shipAlert");
  if (!box) return;
  const list = pendingShipOrders();
  updateOrdersBadge();
  if (!list.length) {
    box.hidden = true;
    box.innerHTML = "";
    return;
  }
  box.hidden = false;
  box.innerHTML = `
    <strong>需要发货</strong>
    <p>有 ${list.length} 笔订单已付款，请尽快发货。</p>
    <div class="admin-ship-list">
      ${list
        .map((o) => {
          const s = o.shipping || {};
          return `<div class="admin-ship-row">
            <button type="button" class="link-btn" data-open-order="${escapeHtml(o.id)}">${escapeHtml(o.id)}</button>
            <span>${escapeHtml(s.name || "-")} · ${escapeHtml(s.phone || "-")}</span>
            <span>$${formatMoney(o.total)}</span>
            <button type="button" class="btn btn-sm" data-ship-order="${escapeHtml(o.id)}">标记已发货</button>
          </div>`;
        })
        .join("")}
    </div>`;
}

async function markOrderShipped(id) {
  const order = (state.orders || []).find((o) => String(o.id) === String(id));
  if (!order) return;
  const ok = await adminConfirm(`确认订单 ${order.id} 已发货？`, "确认发货");
  if (!ok) return;
  try {
    const data = await api("/api/admin/orders", {
      method: "POST",
      body: JSON.stringify({ action: "status", id: order.id, status: shippedStatusFor(order) }),
    });
    if (data.order) {
      const idx = state.orders.findIndex((o) => String(o.id) === String(order.id));
      if (idx >= 0) state.orders[idx] = data.order;
    }
    await loadOrdersBundle();
    const updated = (state.orders || []).find((o) => String(o.id) === String(order.id));
    if (updated && $("orderDetail") && !$("orderDetail").hidden) showOrderDetail(updated);
  } catch (err) {
    await adminAlert(err.message || "更新失败", "发货失败");
  }
}

function productSalesMap() {
  const byId = new Map();
  const byName = new Map();
  (state.orders || []).forEach((order) => {
    if (cancelledOrder(order)) return;
    (order.items || []).forEach((item) => {
      const qty = Number(item && item.qty) || 0;
      if (qty <= 0) return;
      if (item.id != null && String(item.id).trim() !== "") {
        const key = String(item.id);
        byId.set(key, (byId.get(key) || 0) + qty);
        return;
      }
      const name = String((item && item.name) || "").trim();
      if (name) byName.set(name, (byName.get(name) || 0) + qty);
    });
  });
  return { byId, byName };
}

function productSoldQty(product, sales) {
  const byId = sales.byId.get(String(product.id)) || 0;
  const byName = sales.byName.get(String(product.name || "").trim()) || 0;
  return byId + byName;
}

function renderProductsTable() {
  const tbody = $("productsTable").querySelector("tbody");
  const list = allProducts();
  const sales = productSalesMap();
  const allBox = $("selectAllProducts");
  if (allBox) allBox.checked = false;
  tbody.innerHTML = list.length
    ? list
        .map((p) => {
          const custom = p.source === "custom";
          const img = p.img ? `<img class="admin-thumb" src="${escapeHtml(p.img)}" alt="">` : "";
          const sold = productSoldQty(p, sales);
          const status = p.hidden
            ? `<span class="admin-pill off">已下架</span>`
            : `<span class="admin-pill on">在售</span>`;
          return `<tr class="${p.hidden ? "is-hidden-product" : ""}">
        <td><input type="checkbox" class="product-check" value="${escapeHtml(String(p.id))}"></td>
        <td>${img}</td>
        <td>${p.id}</td>
        <td>${escapeHtml(p.name)}</td>
        <td>${escapeHtml(p.category || p.categoryId || "")}</td>
        <td>$${formatMoney(p.price)}</td>
        <td>${sold}</td>
        <td>${status}</td>
        <td>${custom ? "后台上传" : "商城预设"}</td>
        <td class="admin-row-actions">
          <button type="button" data-gallery-product="${p.id}">宣传图</button>
          <button type="button" data-toggle-hidden="${p.id}" data-hidden="${p.hidden ? "1" : "0"}">${
            p.hidden ? "上架" : "下架"
          }</button>
          <button type="button" data-edit-product="${p.id}">编辑</button>
          <button type="button" class="danger" data-del-product="${p.id}">删除</button>
        </td>
      </tr>`;
        })
        .join("")
    : `<tr><td colspan="10" class="admin-empty">暂无产品</td></tr>`;
}

function renderGalleryPanel(productId) {
  const card = $("galleryCard");
  const nameEl = $("galleryProductName");
  const listEl = $("galleryList");
  if (!card || !listEl) return;
  const id = String(productId || "").trim();
  if (!id) {
    card.hidden = true;
    state.galleryProductId = "";
    return;
  }
  const product = allProducts().find((p) => String(p.id) === id);
  state.galleryProductId = id;
  card.hidden = false;
  if (nameEl) nameEl.textContent = product ? `#${product.id} ${product.name}` : `#${id}`;
  const images = (state.galleries[id] || []).slice();
  listEl.innerHTML = images.length
    ? images
        .map((img) => {
          const caption = escapeHtml(img.caption || "");
          return `<div class="admin-gallery-item">
      <img src="${escapeHtml(img.url)}" alt="">
      <textarea data-gallery-caption="${escapeHtml(img.id)}" rows="2" maxlength="200" placeholder="图片说明">${caption}</textarea>
      <div class="admin-gallery-actions">
        <button type="button" class="btn btn-sm" data-save-gallery-caption="${escapeHtml(img.id)}">保存说明</button>
        <button type="button" class="danger" data-del-gallery="${escapeHtml(img.id)}">删除</button>
      </div>
    </div>`;
        })
        .join("")
    : `<p class="admin-tip">还没有宣传图，请选择多张图片后上传。</p>`;
}

function renderOrders() {
  const tbody = $("ordersTable").querySelector("tbody");
  const pending = [];
  const rest = [];
  (state.orders || []).forEach((o) => (needsShipping(o) ? pending : rest).push(o));
  const list = [...pending, ...rest];
  tbody.innerHTML = list.length
    ? list
        .map((o) => {
          const s = o.shipping || {};
          const addr = [s.region, s.address].filter(Boolean).join(" ") || "-";
          const ship = needsShipping(o);
          const wait = awaitingReceive(o);
          const received = orderStage(o) === "received";
          const refund = orderStage(o) === "refund";
          const statusCell = ship
            ? `<span class="admin-pill ship">待发货</span> ${escapeHtml(o.status || "")}`
            : wait
              ? `<span class="admin-pill wait">待收货</span> ${escapeHtml(o.status || "")}`
              : received
                ? `<span class="admin-pill done">已签收</span> ${escapeHtml(o.status || "")}`
                : refund
                  ? `<span class="admin-pill off">退款/售后</span> ${escapeHtml(o.status || "")}`
                  : escapeHtml(stageLabel(o));
          const actionCell = ship
            ? `<button type="button" class="btn btn-sm" data-ship-order="${escapeHtml(o.id)}">标记已发货</button>`
            : wait
              ? `<span class="admin-muted">已发货，待买家收货</span>`
              : received
                ? `<span class="admin-muted">已完成</span>`
                : "-";
          return `<tr data-order-id="${escapeHtml(o.id)}" class="admin-click-row${ship ? " needs-ship" : ""}">
        <td>${escapeHtml(o.id)}</td>
        <td>${escapeHtml(formatTime(o.createdAt))}</td>
        <td>${escapeHtml(s.name || "-")}</td>
        <td>${escapeHtml(s.phone || "-")}</td>
        <td class="admin-addr-cell" title="${escapeHtml(addr)}">${escapeHtml(addr)}</td>
        <td>$${formatMoney(o.total)}</td>
        <td>${statusCell}</td>
        <td>${escapeHtml(o.payMethod || "-")}</td>
        <td class="admin-row-actions">${actionCell}</td>
      </tr>`;
        })
        .join("")
    : `<tr><td colspan="9" class="admin-empty">暂无订单</td></tr>`;
  renderShipAlert();
}

function renderAddressStats() {
  const table = $("addressStatsTable");
  if (!table) return;
  const tbody = table.querySelector("tbody");
  const list = state.addressStats || [];
  tbody.innerHTML = list.length
    ? list
        .map(
          (row) => `<tr>
        <td>${escapeHtml(row.region || "-")}</td>
        <td class="admin-addr-cell" title="${escapeHtml(row.address || row.fullAddress || "")}">${escapeHtml(
            row.address || "-"
          )}</td>
        <td>${row.orderCount || 0}</td>
        <td>${row.customerCount || 0}</td>
        <td>$${formatMoney(row.amount)}</td>
        <td>${escapeHtml(row.sampleNames || "-")}</td>
      </tr>`
        )
        .join("")
        : `<tr><td colspan="6" class="admin-empty">暂无地址统计（有订单后按收货地址汇总）</td></tr>`;
}

function lookupGeoRow(code) {
  const up = String(code || "").toUpperCase();
  const alts = up === "UK" ? ["UK", "GB"] : up === "GB" ? ["GB", "UK"] : [up];
  const rows = (state.geoStats || []).filter((row) => alts.includes(String(row.code || "").toUpperCase()));
  if (!rows.length) return null;
  const visits = rows.reduce((s, row) => s + (Number(row.visits) || 0), 0);
  const orders = rows.reduce((s, row) => s + (Number(row.orders) || 0), 0);
  const cities = rows.map((row) => row.city || row.region).filter(Boolean);
  const uniqueCities = [];
  cities.forEach((name) => {
    if (!uniqueCities.includes(name) && uniqueCities.length < 4) uniqueCities.push(name);
  });
  return {
    code: rows[0].code,
    name: rows[0].country || rows[0].name || up,
    visits,
    orders,
    total: visits + orders,
    detail: uniqueCities.join("、"),
  };
}

function laterIso(a, b) {
  const x = String(a || "");
  const y = String(b || "");
  if (!x) return y;
  if (!y) return x;
  return x >= y ? x : y;
}

function earlierIso(a, b) {
  const x = String(a || "");
  const y = String(b || "");
  if (!x) return y;
  if (!y) return x;
  return x <= y ? x : y;
}

function normalizeGeoKey(key) {
  const parts = String(key || "").split("|");
  if (parts.length >= 4) return parts.slice(0, 3).join("|");
  return String(key || "");
}

function geoRowKey(row) {
  if (row && row.key) return normalizeGeoKey(row.key);
  return [row.code || "", row.region || "", row.city || ""].join("|");
}

function geoCountryCode(row) {
  const up = String((row && row.code) || "").toUpperCase();
  if (!up || up === "UN" || up === "XX") return "UN";
  if (up === "UK") return "GB";
  return up;
}

function geoCountryName(row) {
  const name = String((row && (row.country || row.name)) || "").trim();
  if (name) return name;
  const code = geoCountryCode(row);
  return code === "UN" ? "未知地区" : code;
}

function geoPlaceLabel(row, countryName) {
  const full =
    (row && row.label) ||
    [row && row.region, row && row.city].filter(Boolean).join(" · ") ||
    (row && (row.country || row.name || row.code)) ||
    "-";
  const name = String(countryName || "").trim();
  if (!name) return full;
  if (full === name) return "未细分到城市";
  const prefix = name + " · ";
  if (full.startsWith(prefix)) return full.slice(prefix.length) || "未细分到城市";
  return full;
}

function groupGeoByCountry(list) {
  const groups = new Map();
  (list || []).forEach((row) => {
    const code = geoCountryCode(row);
    if (!groups.has(code)) {
      groups.set(code, {
        code,
        name: geoCountryName(row),
        visits: 0,
        visitors: 0,
        orders: 0,
        total: 0,
        rows: [],
      });
    }
    const group = groups.get(code);
    const countryName = geoCountryName(row);
    if (countryName && countryName !== group.code) group.name = countryName;
    group.visits += Number(row.visits) || 0;
    group.visitors += Number(row.visitors) || 0;
    group.orders += Number(row.orders) || 0;
    group.total += Number(row.total) || (Number(row.visits) || 0) + (Number(row.orders) || 0);
    group.rows.push(row);
  });
  const sorted = Array.from(groups.values()).sort(
    (a, b) =>
      b.visits - a.visits ||
      b.visitors - a.visitors ||
      b.total - a.total ||
      String(a.name).localeCompare(String(b.name), "zh")
  );
  sorted.forEach((group) => {
    group.rows.sort(
      (a, b) =>
        (Number(b.visits) || 0) - (Number(a.visits) || 0) ||
        (Number(b.visitors) || 0) - (Number(a.visitors) || 0) ||
        (Number(b.orders) || 0) - (Number(a.orders) || 0) ||
        String(a.label || "").localeCompare(String(b.label || ""), "zh")
    );
  });
  return sorted;
}

function formatVisitorLocalTime(iso, timezone) {
  const raw = String(iso || "").trim();
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  const opts = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  };
  const tz = String(timezone || "").trim();
  try {
    return date.toLocaleString("zh-CN", tz ? Object.assign({}, opts, { timeZone: tz }) : opts);
  } catch (_) {
    try {
      return date.toLocaleString("zh-CN", opts);
    } catch {
      return raw;
    }
  }
}

function renderGeoVisitTime(row) {
  const last = formatVisitorLocalTime(row.lastAt, row.timezone);
  const first = formatVisitorLocalTime(row.firstAt, row.timezone);
  if (!last && !first) return "-";
  const tz = String(row.timezone || "").trim();
  const bits = [escapeHtml(last || first)];
  if (first && last && first !== last) {
    bits.push(`<div class="admin-geo-time-sub">首次 ${escapeHtml(first)}</div>`);
  }
  if (tz) bits.push(`<div class="admin-geo-time-sub">${escapeHtml(tz)}</div>`);
  return bits.join("");
}

function applyVisitCountriesToGeo() {
  const visits = state.visits;
  if (!visits) return;
  const placeList = Array.isArray(visits.places) ? visits.places : [];
  const countryList = Array.isArray(visits.countries) ? visits.countries : [];
  if (!placeList.length && !countryList.length) return;

  const prevMap = new Map((state.geoStats || []).map((row) => [geoRowKey(row), row]));
  const nextMap = new Map();

  function upsertVisit(row) {
    const key = geoRowKey(row);
    const prev = prevMap.get(key) || nextMap.get(key) || {};
    const visitCount = Number(row.visits != null ? row.visits : row.pv) || 0;
    const visitorCount = Number(row.visitors != null ? row.visitors : row.uv) || 0;
    const orders = Number(prev.orders) || 0;
    const lastAt = laterIso(row.lastAt, prev.lastAt);
    const firstAt = earlierIso(row.firstAt, prev.firstAt);
    const timezone =
      (lastAt && lastAt === String(row.lastAt || "") ? row.timezone : prev.timezone) ||
      row.timezone ||
      prev.timezone ||
      "";
    nextMap.set(key, {
      key,
      code: row.code || prev.code || "",
      name: row.country || row.name || prev.country || prev.name || key,
      country: row.country || row.name || prev.country || prev.name || "",
      region: row.region || prev.region || "",
      city: row.city || prev.city || "",
      label: row.label || prev.label || "",
      streets: Array.isArray(prev.streets) ? prev.streets : [],
      visits: visitCount,
      visitors: visitorCount,
      orders,
      total: visitCount + orders,
      lastAt,
      firstAt,
      timezone,
    });
  }

  placeList.forEach(upsertVisit);
  countryList.forEach((row) => {
    const code = String(row.code || "").toUpperCase();
    const usedVisits = Array.from(nextMap.values())
      .filter((item) => String(item.code || "").toUpperCase() === code)
      .reduce((sum, item) => sum + (Number(item.visits) || 0), 0);
    const usedUv = Array.from(nextMap.values())
      .filter((item) => String(item.code || "").toUpperCase() === code)
      .reduce((sum, item) => sum + (Number(item.visitors) || 0), 0);
    const remPv = Math.max(0, (Number(row.pv) || 0) - usedVisits);
    const remUv = Math.max(0, (Number(row.uv) || 0) - usedUv);
    if (!remPv && !remUv) return;
    const name = row.name || code;
    upsertVisit({
      key: code + "||",
      code,
      country: name,
      name,
      label: usedVisits ? name + "（未细分到城市）" : name,
      visits: remPv,
      visitors: remUv,
      pv: remPv,
      uv: remUv,
      lastAt: row.lastAt,
      firstAt: row.firstAt,
      timezone: row.timezone,
    });
  });
  prevMap.forEach((row, key) => {
    if (nextMap.has(key)) return;
    if (!(Number(row.orders) > 0)) return;
    nextMap.set(key, {
      ...row,
      visits: Number(row.visits) || 0,
      visitors: Number(row.visitors) || 0,
      total: (Number(row.visits) || 0) + (Number(row.orders) || 0),
    });
  });
  const deleted = new Set(
    Array.isArray(visits.geoDeletedKeys) ? visits.geoDeletedKeys.map((id) => normalizeGeoKey(id)) : []
  );
  state.geoStats = groupGeoByCountry(
    Array.from(nextMap.values()).filter((row) => !deleted.has(geoRowKey(row)))
  ).flatMap((group) => group.rows);
}

function renderGeoStats() {
  const table = $("geoStatsTable");
  const summary = $("geoSummary");
  const list = state.geoStats || [];
  const groups = groupGeoByCountry(list);
  const visitSum = list.reduce((s, row) => s + (Number(row.visits) || 0), 0);
  const visitorSum = list.reduce((s, row) => s + (Number(row.visitors) || 0), 0);
  const orderSum = list.reduce((s, row) => s + (Number(row.orders) || 0), 0);
  const clearBtn = $("clearGeo");
  if (clearBtn) clearBtn.disabled = !list.length;
  if (summary) {
    summary.textContent = list.length
      ? `${groups.length} 个国家 · ${list.length} 条地址 · 访客 ${visitorSum} · 访问 ${visitSum} · 下单 ${orderSum}`
      : "";
  }
  if (table) {
    const tbody = table.querySelector("tbody");
    tbody.innerHTML = list.length
      ? groups
          .map((group) => {
            const codeLabel = group.code === "UN" ? "" : escapeHtml(group.code);
            const head = `<tr class="admin-geo-country">
        <td colspan="7">
          <div class="admin-geo-country-row">
            <strong>${escapeHtml(group.name)}</strong>
            ${codeLabel ? `<span class="admin-geo-country-code">${codeLabel}</span>` : ""}
            <span class="admin-geo-country-stat">${group.rows.length} 个地址</span>
            <span class="admin-geo-country-stat">访客 ${group.visitors}</span>
            <span class="admin-geo-country-stat">访问 ${group.visits}</span>
            <span class="admin-geo-country-stat">下单 ${group.orders}</span>
          </div>
        </td>
      </tr>`;
            const rows = group.rows
              .map((row) => {
                const key = geoRowKey(row);
                const label = geoPlaceLabel(row, group.name);
                return `<tr class="admin-geo-place">
        <td class="admin-addr-detail" title="${escapeHtml(label)}">${escapeHtml(label)}</td>
        <td class="admin-geo-time">${renderGeoVisitTime(row)}</td>
        <td>${row.visits || 0}</td>
        <td>${row.visitors || 0}</td>
        <td>${row.orders || 0}</td>
        <td><strong>${row.total || 0}</strong></td>
        <td class="admin-row-actions">${
          key
            ? `<button type="button" class="danger" data-del-geo="${escapeHtml(key)}">删除</button>`
            : "-"
        }</td>
      </tr>`;
              })
              .join("");
            return head + rows;
          })
          .join("")
      : `<tr><td colspan="7" class="admin-empty">暂无全球地址数据。访客打开商城或客户下单后，将按详细地址累计，并记录访问者当地时间。</td></tr>`;
  }
  if (state.currentTab === "geo") {
    if (geoMapTimer) clearTimeout(geoMapTimer);
    geoMapTimer = setTimeout(() => renderWorldMap(), 40);
  }
}

async function applyGeoResult(data) {
  if (data.visits) state.visits = data.visits;
  if (Array.isArray(data.geoStats)) state.geoStats = data.geoStats;
  renderGeoStats();
}

async function deleteGeoRow(key) {
  const geoKey = String(key || "").trim();
  if (!geoKey) return;
  if (!(await adminConfirm("确定删除这条地址统计？删除后该地址不再出现在全球地址中，订单和访问量本身不会删除。", "删除地址统计"))) return;
  const data = await api("/api/admin/orders", {
    method: "POST",
    body: JSON.stringify({ action: "delete-geo", key: geoKey }),
  });
  await applyGeoResult(data);
}

async function clearGeoHistory() {
  if (!(state.geoStats || []).length) {
    await adminAlert("当前没有地址统计。", "清空地址统计");
    return;
  }
  if (!(await adminConfirm("确定清空全部地址统计？地图和明细会从服务器清掉，日访问量不受影响。", "清空地址统计"))) return;
  const data = await api("/api/admin/orders", {
    method: "POST",
    body: JSON.stringify({ action: "clear-geo" }),
  });
  await applyGeoResult(data);
}

function destroyGeoMap() {
  if (geoMap && typeof geoMap.destroy === "function") {
    try {
      geoMap.destroy();
    } catch (_) {}
  }
  geoMap = null;
}

function heatColor(value, max) {
  const t = max <= 0 ? 0 : 0.22 + 0.78 * Math.sqrt(Math.max(0, Number(value) || 0) / max);
  const from = [26, 61, 88];
  const to = [46, 230, 255];
  const rgb = from.map((c, i) => Math.round(c + (to[i] - c) * t));
  return `#${rgb.map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

function paintGeoRegions(values) {
  if (!geoMap || !geoMap.regions) return;
  const max = Math.max(1, ...Object.values(values).map((n) => Number(n) || 0));
  Object.keys(geoMap.regions).forEach((code) => {
    const region = geoMap.regions[code];
    if (!region || !region.element || typeof region.element.setStyle !== "function") return;
    const val = Number(values[code]) || 0;
    region.element.setStyle("fill", val > 0 ? heatColor(val, max) : "#152033");
  });
}

function renderWorldMap() {
  const host = $("geoWorldMap");
  if (!host) return;
  const list = state.geoStats || [];
  const values = {};
  list.forEach((row) => {
    const code = String(row.code || "").toUpperCase();
    if (!/^[A-Z]{2}$/.test(code) || code === "UN") return;
    const total = Number(row.total) || 0;
    if (total <= 0) return;
    values[code] = (Number(values[code]) || 0) + total;
    if (code === "GB") values.UK = total;
  });

  if (typeof jsVectorMap !== "function") {
    destroyGeoMap();
    host.innerHTML = `<div class="admin-geo-empty">世界地图组件未能加载，下方表格仍可查看各国访问与下单次数。</div>`;
    return;
  }

  destroyGeoMap();
  host.innerHTML = "";
  try {
    geoMap = new jsVectorMap({
      selector: "#geoWorldMap",
      map: "world",
      backgroundColor: "transparent",
      draggable: true,
      zoomButtons: true,
      zoomOnScroll: false,
      regionStyle: {
        initial: {
          fill: "#152033",
          fillOpacity: 1,
          stroke: "rgba(46, 230, 255, 0.28)",
          strokeWidth: 0.4,
          strokeOpacity: 1,
        },
        hover: {
          fill: "#ff7a18",
          fillOpacity: 1,
        },
      },
      onRegionTooltipShow(event, tooltip, code) {
        const row = lookupGeoRow(code);
        const text = row
          ? `${row.name}（${row.code}）\n访问 ${row.visits || 0} · 下单 ${row.orders || 0} · 合计 ${row.total || 0}${
              row.detail ? `\n城市：${row.detail}` : ""
            }`
          : `${code}：暂无记录`;
        if (tooltip && typeof tooltip.text === "function") tooltip.text(text);
      },
    });
    paintGeoRegions(values);
    if (geoMap && typeof geoMap.updateSize === "function") {
      requestAnimationFrame(() => geoMap.updateSize());
    }
  } catch (err) {
    host.innerHTML = `<div class="admin-geo-empty">地图渲染失败：${escapeHtml(err.message || err)}</div>`;
  }
}

function showOrderDetail(order) {
  const box = $("orderDetail");
  if (!order) {
    box.hidden = true;
    box.innerHTML = "";
    return;
  }
  const s = order.shipping || {};
  const items = (order.items || [])
    .map((i) => `<li>${escapeHtml(i.name)} × ${i.qty}　$${formatMoney((i.price || 0) * (i.qty || 0))}</li>`)
    .join("");
  const shipNote = needsShipping(order)
    ? `<p class="admin-ship-note">客户已付款，买卖双方均显示待发货。收货：${escapeHtml(s.name || "-")} · ${escapeHtml(
        s.phone || "-"
      )} · ${escapeHtml([s.region, s.address].filter(Boolean).join(" ") || "-")}</p>
       <p><button type="button" class="btn btn-sm" data-ship-order="${escapeHtml(order.id)}">标记已发货</button></p>`
    : awaitingReceive(order)
      ? `<p class="admin-muted">已发货，买家仓库显示待收货。</p>`
      : orderStage(order) === "received"
        ? `<p class="admin-muted">买家已确认收货。</p>`
        : orderStage(order) === "refund"
          ? `<p class="admin-muted">退款/售后处理中。</p>`
          : "";
  box.hidden = false;
  box.innerHTML = `
    <h3>订单详情 ${escapeHtml(order.id)}</h3>
    ${shipNote}
    <p>收货：${escapeHtml(s.name || "")} · ${escapeHtml(s.phone || "")} · ${escapeHtml(s.email || "")}</p>
    <p>地址：${escapeHtml(s.region || "")} ${escapeHtml(s.address || "")}</p>
    <p>支付：${escapeHtml(order.payMethod || "-")} · 状态：${escapeHtml(stageLabel(order))}（${escapeHtml(order.status || "-")}）</p>
    ${order.userEmail ? `<p>关联账号：${escapeHtml(order.userEmail)}</p>` : ""}
    <ul>${items}</ul>
    <p><strong>合计 $${formatMoney(order.total)}</strong></p>
  `;
}

function renderCustomers() {
  const tbody = $("customersTable").querySelector("tbody");
  const list = state.customers || [];
  tbody.innerHTML = list.length
    ? list
        .map(
          (c) => `<tr>
        <td>${escapeHtml(c.name || "-")}</td>
        <td>${escapeHtml(c.phone || "-")}</td>
        <td>${escapeHtml(c.email || "-")}</td>
        <td>${escapeHtml(c.region || "-")}</td>
        <td class="admin-addr-cell" title="${escapeHtml(c.address || "")}">${escapeHtml(c.address || "-")}</td>
        <td>${c.orderCount || 0}</td>
        <td>$${formatMoney(c.totalSpent)}</td>
        <td>${escapeHtml(c.lastOrderId || "-")}<br><span class="admin-muted">${escapeHtml(
            formatTime(c.lastOrderAt)
          )}</span></td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="8" class="admin-empty">暂无客户资料</td></tr>`;
}

function formatLoginTime(iso) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("zh-CN", { hour12: false });
  } catch {
    return String(iso);
  }
}

function adminClientInfo() {
  const ua = navigator.userAgent || "";
  const params = new URLSearchParams(location.search);
  let client = String(params.get("client") || "").toLowerCase();
  if (!client && /Android/i.test(ua) && /; wv\)/i.test(ua)) client = "android";
  if (!client && window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) {
    client = /Windows/i.test(ua) ? "windows" : "app";
  }
  return {
    client,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    language: navigator.language || "",
    platform: navigator.platform || "",
    screen: (window.screen ? window.screen.width : 0) + "x" + (window.screen ? window.screen.height : 0),
  };
}

async function recordAdminLogin(reason) {
  const now = Date.now();
  if (reason !== "password") {
    let prev = 0;
    try {
      prev = Number(sessionStorage.getItem("shr_admin_login_rec") || 0);
    } catch (_) {}
    if (now - prev < 60 * 60 * 1000) return;
  }
  try {
    sessionStorage.setItem("shr_admin_login_rec", String(now));
  } catch (_) {}
  try {
    await api("/api/admin/auth", {
      method: "POST",
      body: JSON.stringify(Object.assign({ action: "login", reason: reason || "auto" }, adminClientInfo())),
    });
  } catch (_) {}
}

function renderLogins() {
  const table = $("loginsTable");
  if (!table) return;
  const tbody = table.querySelector("tbody");
  const list = state.logins || [];
  const clearBtn = $("clearLogins");
  if (clearBtn) clearBtn.disabled = !list.length;
  tbody.innerHTML = list.length
    ? list
        .map(
          (row) => `<tr>
        <td>${escapeHtml(formatLoginTime(row.at))}</td>
        <td>${escapeHtml(row.client || "网页后台")}</td>
        <td>${escapeHtml(row.os || row.system || "-")}</td>
        <td>${escapeHtml(row.browser || "-")}</td>
        <td>${escapeHtml(row.device || "-")}</td>
        <td class="admin-addr-cell" title="${escapeHtml(row.address || "")}">${escapeHtml(row.address || "-")}</td>
        <td>${escapeHtml(row.ip || "-")}</td>
        <td>${escapeHtml(row.reason === "password" ? "密码登录" : "自动进入")}</td>
        <td class="admin-row-actions">${
          row.id
            ? `<button type="button" class="danger" data-del-login="${escapeHtml(row.id)}">删除</button>`
            : "-"
        }</td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="9" class="admin-empty">暂无登录记录。使用密码登录后台后会出现在这里。</td></tr>`;
}

async function loadLoginHistory() {
  const data = await api("/api/admin/auth");
  state.logins = data.logins || [];
  renderLogins();
}

async function deleteLogin(id) {
  const loginId = String(id || "").trim();
  if (!loginId) return;
  if (!(await adminConfirm("确定删除这条登录记录？删除后无法恢复。", "删除登录记录"))) return;
  const data = await api("/api/admin/auth", {
    method: "POST",
    body: JSON.stringify({ action: "delete", id: loginId }),
  });
  state.logins = data.logins || [];
  renderLogins();
}

async function clearLoginHistory() {
  if (!(state.logins || []).length) {
    await adminAlert("当前没有登录记录。", "清空登录历史");
    return;
  }
  if (!(await adminConfirm("确定清空全部登录历史？所有记录会从服务器删除，无法恢复。", "清空登录历史"))) return;
  const data = await api("/api/admin/auth", {
    method: "POST",
    body: JSON.stringify({ action: "clear" }),
  });
  state.logins = data.logins || [];
  renderLogins();
}

function renderUsers() {
  const tbody = $("usersTable").querySelector("tbody");
  const list = state.users || [];
  const tip = $("usersStorageTip");
  const statusEl = $("usersStorageStatus");
  const clearBtn = $("clearUsers");
  if (clearBtn) clearBtn.disabled = !list.length;
  if (tip) {
    tip.textContent = state.usersStorageOk
      ? "注册成功后资料保存在服务器；打开后台会自动从服务器下载显示。可删除指定账号，或清空全部注册资料。"
      : "服务器云存储未就绪：请在 Cloudflare Pages 绑定 R2 桶 SHR_BUCKET（develop-boards）并重新部署后再试。";
  }
  if (statusEl) {
    statusEl.textContent = state.usersStorageMessage || "";
    statusEl.className = state.usersStorageOk ? "admin-status" : "admin-status error";
  }
  tbody.innerHTML = list.length
    ? list
        .map((u) => {
          const source =
            u.source === "local-sync" || u.source === "sync-code" || u.source === "import" ? "导入" : "服务器";
          const place = u.registerPlaceLabel || (u.registerPlace && u.registerPlace.label) || "-";
          const key = String(u.id || u.email || "").trim();
          return `<tr>
        <td>${escapeHtml(u.id)}</td>
        <td>${escapeHtml(u.name || "-")}</td>
        <td>${escapeHtml(u.email || "-")}</td>
        <td>${escapeHtml(u.phone || "-")}</td>
        <td>${escapeHtml(place)}</td>
        <td>${escapeHtml(formatTime(u.createdAt))}</td>
        <td>${escapeHtml(source)}</td>
        <td class="admin-row-actions">${
          key
            ? `<button type="button" class="danger" data-del-user="${escapeHtml(key)}">删除</button>`
            : "-"
        }</td>
      </tr>`;
        })
        .join("")
    : `<tr><td colspan="8" class="admin-empty">服务器暂无注册用户</td></tr>`;
}

function applyUsersResult(data) {
  if (!data) return;
  if (Array.isArray(data.users)) state.users = data.users;
  if (data.storage) state.usersStorage = data.storage;
  if (data.storageOk != null) state.usersStorageOk = Boolean(data.storageOk);
  else state.usersStorageOk = data.storage === "blob" || data.storage === "local";
  if (data.storageMessage != null) state.usersStorageMessage = data.storageMessage;
  renderUsers();
  renderStats();
}

async function deleteUserRow(id) {
  const userId = String(id || "").trim();
  if (!userId) return;
  if (!(await adminConfirm("确定删除这条注册资料？删除后该账号无法登录，同一邮箱和名称可以重新注册。", "删除注册资料"))) return;
  const data = await api("/api/admin/users", {
    method: "POST",
    body: JSON.stringify({ action: "delete", id: userId }),
  });
  applyUsersResult(data);
}

async function clearUsersHistory() {
  if (!(state.users || []).length) {
    await adminAlert("当前没有注册资料。", "清空注册资料");
    return;
  }
  if (!(await adminConfirm("确定清空全部注册资料？所有注册账号会从服务器删除，无法恢复。", "清空注册资料"))) return;
  const data = await api("/api/admin/users", {
    method: "POST",
    body: JSON.stringify({ action: "clear" }),
  });
  applyUsersResult(data);
}

async function refreshList() {
  const box = $("fileList");
  box.textContent = "加载中…";
  try {
    const data = await api("/api/admin/files");
    const manifest = data.downloads || {};
    const products = allProducts();
    const ids = Array.from(
      new Set([...products.map((p) => String(p.id)), ...Object.keys(manifest)])
    ).sort((a, b) => Number(a) - Number(b));

    if (ids.length === 0) {
      box.textContent = "暂无资料";
      return;
    }

    box.innerHTML = ids
      .map((id) => {
        const product = products.find((p) => String(p.id) === String(id));
        const title = product ? product.name : `商品 #${id}`;
        const list = Array.isArray(manifest[id]) ? manifest[id] : [];
        const rows =
          list.length === 0
            ? `<p class="admin-tip">尚无上传资料</p>`
            : list
                .map(
                  (f) => `
          <div class="admin-file-row">
            <div>
              <div>${escapeHtml(f.name)} <span style="color:var(--primary)">${escapeHtml(f.format || "")}</span></div>
              <div style="color:var(--text-muted);font-size:12px">${formatSize(f.size)} · ${escapeHtml(f.uploadedAt || "")}</div>
            </div>
            <div class="admin-file-actions">
              <a href="${escapeHtml(f.file)}" download target="_blank" rel="noopener">下载</a>
              <button type="button" class="danger" data-del-doc-product="${id}" data-del-id="${escapeHtml(f.id)}">删除</button>
            </div>
          </div>`
                )
                .join("");
        return `<div class="admin-product-block"><h3>#${id} ${escapeHtml(title)}</h3>${rows}</div>`;
      })
      .join("");
  } catch (err) {
    box.innerHTML = `<p class="admin-status error">${escapeHtml(err.message)}</p>`;
  }
}

async function loadOrdersBundle() {
  const data = await api("/api/admin/orders");
  state.orders = data.orders || [];
  state.stats = data.stats || null;
  state.customers = data.customers || [];
  state.addressStats = data.addressStats || [];
  state.geoStats = data.geoStats || [];
  if (data.visits) state.visits = data.visits;
  renderStats();
  renderOrders();
  renderAddressStats();
  renderGeoStats();
  renderCustomers();
  renderProductsTable();
}

function markVisitUpdated() {
  const el = $("visitUpdatedAt");
  if (!el) return;
  const iso = state.visits && state.visits.updatedAt;
  try {
    el.textContent = "更新于 " + new Date(iso || Date.now()).toLocaleTimeString("zh-CN", { hour12: false });
  } catch {
    el.textContent = "";
  }
}

function startVisitLive() {
  if (visitTimer) return;
  visitTimer = setInterval(() => {
    if (!getPass() || document.hidden) return;
    if (state.currentTab === "dashboard" || state.currentTab === "geo") loadVisits().catch(() => {});
    loadOrdersBundle().catch(() => {});
    if (state.currentTab !== "chat") loadChatList().catch(() => {});
  }, 15000);
}

function stopVisitLive() {
  if (!visitTimer) return;
  clearInterval(visitTimer);
  visitTimer = null;
}

async function loadVisits() {
  const data = await api("/api/admin/orders?only=visits");
  if (data.visits) state.visits = data.visits;
  applyVisitCountriesToGeo();
  renderStats();
  renderGeoStats();
}

async function loadProductsBundle() {
  const formSnap = snapshotProductForm();
  const data = await api("/api/admin/products");
  state.customProducts = data.products || [];
  state.hiddenIds = data.hiddenIds || [];
  state.deletedIds = data.deletedIds || [];
  state.galleries = data.galleries || {};
  state.categories = Array.isArray(data.categories) ? data.categories : [];
  fillCategorySelect();
  restoreProductFormSnapshot(formSnap);
  pinFormDefaults();
  renderCategoriesTable();
  renderProductsTable();
  productOptions();
  if (state.galleryProductId) renderGalleryPanel(state.galleryProductId);
  syncEditMode();
}

async function loadUsers() {
  const data = await api("/api/admin/users");
  applyUsersResult(data);
}

function updateChatBadge() {
  const badge = $("chatTabBadge");
  if (!badge) return;
  const n = Number(state.chatUnread) || 0;
  badge.hidden = n <= 0;
  badge.textContent = n > 99 ? "99+" : String(n);
}

function chatDisplayName(t) {
  if (t && t.displayName) return t.displayName;
  if (t && (t.member || t.name || t.email)) {
    return t.name || String(t.email || "").split("@")[0] || "会员";
  }
  const raw = String((t && t.visitorId) || "").replace(/^v/i, "") || "0";
  return "游客" + raw;
}

function renderChatList() {
  updateChatBadge();
  const box = $("adminChatList");
  if (!box) return;
  const threads = state.chatThreads || [];
  if (!threads.length) {
    box.innerHTML = `<p class="admin-tip">还没有客户留言。</p>`;
    return;
  }
  box.innerHTML = threads
    .map((t) => {
      const title = chatDisplayName(t);
      const unread = Number(t.unreadAdmin) || 0;
      const active = String(t.visitorId) === String(state.activeChatVisitorId) ? " is-active" : "";
      return `<div class="admin-chat-item${active}${unread ? " has-unread" : ""}" data-chat-visitor="${escapeHtml(t.visitorId)}" role="button" tabindex="0">
        <div class="admin-chat-item-top">
          <strong><span class="presence-dot${t.online ? " is-online" : ""}"></span>${escapeHtml(title)}</strong>
          <span class="admin-chat-item-tools">
            ${unread ? `<span class="admin-tab-badge">${unread}</span>` : ""}
            <button type="button" class="link-btn admin-chat-del-thread" data-del-thread="${escapeHtml(t.visitorId)}" title="删除会话">删除</button>
          </span>
        </div>
        <div class="admin-chat-item-preview">${escapeHtml(t.lastMessage || "")}</div>
        <div class="admin-chat-item-time">${formatTime(t.updatedAt)}</div>
      </div>`;
    })
    .join("");
}

function renderChatThread() {
  const head = $("adminChatHead");
  const box = $("adminChatMsgs");
  const input = $("adminChatInput");
  const send = $("adminChatSend");
  const thread = state.chatThread;
  const clearBtn = $("clearChatThread");
  const deleteBtn = $("deleteChatThread");
  if (!thread) {
    if (head) head.textContent = "请选择左侧会话";
    if (box) box.innerHTML = "";
    if (input) input.disabled = true;
    if (send) send.disabled = true;
    if (clearBtn) clearBtn.disabled = true;
    if (deleteBtn) deleteBtn.disabled = true;
    return;
  }
  const title = chatDisplayName(thread);
  if (head) {
    const online = Boolean(thread.online);
    head.innerHTML = `<span class="presence-dot${online ? " is-online" : ""}"></span><span>${escapeHtml(title)}</span><span class="admin-online-label${online ? " is-online" : ""}">${online ? "在线" : "离线"}</span>`;
  }
  if (input) input.disabled = false;
  if (send) send.disabled = false;
  if (clearBtn) clearBtn.disabled = false;
  if (deleteBtn) deleteBtn.disabled = false;
  const msgs = thread.messages || [];
  if (box) {
    box.innerHTML = msgs.length
      ? msgs
          .map((m, i) => {
            const role = m.role === "admin" ? "admin" : m.role === "bot" ? "bot" : "user";
            const label =
              role === "admin"
                ? "卖家"
                : role === "bot"
                  ? "自动回复"
                  : chatDisplayName(thread) + (thread.online ? " · 在线" : " · 离线");
            const msgId = m.id || "idx-" + i;
            return `<div class="admin-chat-bubble ${role}">
          <div class="admin-chat-bubble-label">
            <span>${escapeHtml(label)}</span>
            <button type="button" class="link-btn admin-chat-del-msg" data-del-msg="${escapeHtml(msgId)}" title="删除这条消息">删除</button>
          </div>
          <div>${escapeHtml(m.text || "")}</div>
          <div class="chat-time">${formatTime(m.createdAt)}</div>
        </div>`;
          })
          .join("")
      : `<p class="admin-tip">该会话暂无消息。</p>`;
    box.scrollTop = box.scrollHeight;
  }
}

async function loadChatList() {
  const live = state.currentTab === "chat" && !document.hidden;
  const data = await api("/api/admin/chat" + (live ? "?presence=1" : ""));
  state.chatThreads = data.threads || [];
  state.chatUnread = data.unread || 0;
  state.autoReply = data.autoReply || state.autoReply;
  if (state.chatThread && state.chatThread.visitorId) {
    const listed = state.chatThreads.find((t) => String(t.visitorId) === String(state.chatThread.visitorId));
    if (listed) state.chatThread.online = Boolean(listed.online);
  }
  renderChatList();
  if (state.chatThread) renderChatThread();
  fillAutoReplyForm(state.autoReply);
}

function fillAutoReplyForm(settings) {
  const enabled = $("autoReplyEnabled");
  const message = $("autoReplyMessage");
  if (!enabled || !message) return;
  if (document.activeElement === enabled || document.activeElement === message) return;
  enabled.checked = Boolean(settings && settings.enabled);
  if (settings && settings.message) message.value = settings.message;
}

async function openChatThread(visitorId) {
  state.activeChatVisitorId = visitorId;
  renderChatList();
  const data = await api("/api/admin/chat?visitorId=" + encodeURIComponent(visitorId) + "&presence=1");
  state.chatThread = data.conversation || null;
  renderChatThread();
  await loadChatList();
}

async function applyChatConversation(conversation) {
  state.chatThread = conversation || null;
  if (!state.chatThread) {
    state.activeChatVisitorId = "";
  }
  renderChatThread();
  await loadChatList();
}

async function deleteChatMessage(messageId) {
  if (!state.activeChatVisitorId || !messageId) return;
  if (!(await adminConfirm("确定删除这条消息？删除后客户窗口也会同步。", "删除消息"))) return;
  const data = await api("/api/admin/chat", {
    method: "POST",
    body: JSON.stringify({
      action: "delete-message",
      visitorId: state.activeChatVisitorId,
      messageId,
    }),
  });
  await applyChatConversation(data.conversation);
}

async function clearChatThread() {
  if (!state.activeChatVisitorId) return;
  const name = chatDisplayName(state.chatThread || { visitorId: state.activeChatVisitorId });
  if (!(await adminConfirm("确定清空「" + name + "」的全部消息？会话会保留，消息会从服务器删除。", "清空会话"))) return;
  const data = await api("/api/admin/chat", {
    method: "POST",
    body: JSON.stringify({
      action: "clear-thread",
      visitorId: state.activeChatVisitorId,
    }),
  });
  await applyChatConversation(data.conversation);
}

async function removeChatThread(visitorId) {
  const vid = String(visitorId || state.activeChatVisitorId || "").trim();
  if (!vid) return;
  const listed = (state.chatThreads || []).find((t) => String(t.visitorId) === vid);
  const name = chatDisplayName(listed || state.chatThread || { visitorId: vid });
  if (!(await adminConfirm("确定删除「" + name + "」的整个会话？会话和消息都会从服务器删除。", "删除会话"))) return;
  await api("/api/admin/chat", {
    method: "POST",
    body: JSON.stringify({
      action: "delete-thread",
      visitorId: vid,
    }),
  });
  if (String(state.activeChatVisitorId) === vid) {
    state.activeChatVisitorId = "";
    state.chatThread = null;
  }
  renderChatThread();
  await loadChatList();
}

let chatTimer = null;

function startChatLive() {
  if (chatTimer) return;
  chatTimer = setInterval(() => {
    if (!getPass() || document.hidden || state.currentTab !== "chat") return;
    const refresh = state.activeChatVisitorId
      ? openChatThread(state.activeChatVisitorId)
      : loadChatList();
    refresh.catch(() => {});
  }, 5000);
}

function stopChatLive() {
  if (!chatTimer) return;
  clearInterval(chatTimer);
  chatTimer = null;
}

async function loadAll() {
  const tasks = [
    loadOrdersBundle(),
    loadProductsBundle(),
    loadUsers(),
    loadVisits(),
    refreshList(),
    loadChatList(),
    loadLoginHistory(),
  ];
  const results = await Promise.allSettled(tasks);
  const failed = results.slice(0, 5).find((r) => r.status === "rejected");
  if (failed) throw failed.reason;
}

function linesOf(list) {
  return (Array.isArray(list) ? list : []).map((item) => String(item || "").trim()).filter(Boolean).join("\n");
}

function pairsToText(list) {
  return (Array.isArray(list) ? list : [])
    .map((row) => (Array.isArray(row) ? row.map((part) => String(part || "").trim()).join(" | ") : String(row || "")))
    .filter((line) => line.replace(/\|/g, "").trim())
    .join("\n");
}

function textToLines(text) {
  return String(text || "")
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function textToRows(text, width) {
  return textToLines(text).map((line) => {
    const parts = line.split("|").map((part) => part.trim());
    if (width) {
      while (parts.length < width) parts.push("");
      return parts.slice(0, width);
    }
    return parts;
  });
}

function downloadsToText(list) {
  return (Array.isArray(list) ? list : [])
    .map((item) => {
      if (!item) return "";
      if (typeof item === "string") return item;
      return [item.name || "", item.file || item.url || "", item.format || ""].join(" | ");
    })
    .filter((line) => line.replace(/\|/g, "").trim())
    .join("\n");
}

function textToDownloads(text) {
  return textToRows(text)
    .map((row) => ({ name: row[0] || "", file: row[1] || "", format: row[2] || "" }))
    .filter((item) => item.name || item.file);
}

function englishPackFor(product) {
  const stored = product && product.en && typeof product.en === "object" ? product.en : {};
  const fallback = (window.PRODUCT_EN && product && window.PRODUCT_EN[product.id]) || {};
  return Object.assign({}, fallback, stored);
}

function galleryItemsFrom(list) {
  return (Array.isArray(list) ? list : [])
    .map((item, index) => {
      if (!item) return null;
      if (typeof item === "string") {
        return { key: "g" + index + "-" + Date.now(), id: item, url: item, caption: "", captionEn: "", file: null };
      }
      const url = String(item.url || "").trim();
      if (!url) return null;
      return {
        key: String(item.id || "g" + index) + "-" + index,
        id: item.id || url,
        url,
        caption: item.caption || "",
        captionEn: item.captionEn || "",
        file: null,
      };
    })
    .filter(Boolean);
}

function renderEditGallery(listName, elementId) {
  const box = $(elementId);
  if (!box) return;
  const list = state[listName] || [];
  box.innerHTML = list.length
    ? list
        .map((item, index) => {
          const src = item.file ? "" : item.url;
          const captions =
            listName === "editGalleryEn"
              ? `<textarea data-edit-caption-en="${escapeHtml(item.key)}" rows="2" maxlength="200" placeholder="英文说明">${escapeHtml(item.captionEn || item.caption || "")}</textarea>`
              : `<textarea data-edit-caption="${escapeHtml(item.key)}" rows="2" maxlength="200" placeholder="中文说明">${escapeHtml(item.caption || "")}</textarea>
        <textarea data-edit-caption-en="${escapeHtml(item.key)}" rows="2" maxlength="200" placeholder="英文说明">${escapeHtml(item.captionEn || "")}</textarea>`;
          return `<div class="admin-gallery-item" data-edit-key="${escapeHtml(item.key)}">
        <img src="${escapeHtml(src)}" alt="" ${item.file ? "data-local-preview=\"1\"" : ""}>
        <div class="admin-hint">${index === 0 && listName === "editGallery" ? "主图" : "图片 " + (index + 1)}</div>
        ${captions}
        <button type="button" class="danger" data-remove-edit-image="${escapeHtml(item.key)}" data-edit-list="${listName}">删除</button>
      </div>`;
        })
        .join("")
    : `<p class="admin-tip">还没有图片。</p>`;
  box.querySelectorAll("img[data-local-preview]").forEach((img) => {
    const key = img.closest("[data-edit-key]") && img.closest("[data-edit-key]").dataset.editKey;
    const item = list.find((entry) => entry.key === key);
    if (item && item.file) img.src = URL.createObjectURL(item.file);
  });
}

function bindEditGallery(listName, elementId) {
  const box = $(elementId);
  if (!box || box.dataset.boundGallery) return;
  box.dataset.boundGallery = "1";
  box.addEventListener("input", (e) => {
    const caption = e.target.closest("[data-edit-caption]");
    const captionEn = e.target.closest("[data-edit-caption-en]");
    const key = (caption && caption.dataset.editCaption) || (captionEn && captionEn.dataset.editCaptionEn);
    if (!key) return;
    const item = (state[listName] || []).find((entry) => entry.key === key);
    if (!item) return;
    if (caption) item.caption = caption.value;
    if (captionEn) item.captionEn = captionEn.value;
  });
  box.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-remove-edit-image]");
    if (!btn || btn.dataset.editList !== listName) return;
    state[listName] = (state[listName] || []).filter((entry) => entry.key !== btn.dataset.removeEditImage);
    state.editGalleryActive = true;
    renderEditGallery(listName, elementId);
  });
}

function addEditGalleryFiles(listName, elementId, files) {
  const list = state[listName] || [];
  Array.from(files || []).forEach((file) => {
    if (list.length >= 12) return;
    list.push({
      key: "new-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
      id: "",
      url: "",
      caption: "",
      captionEn: "",
      file,
    });
  });
  state[listName] = list;
  state.editGalleryActive = true;
  renderEditGallery(listName, elementId);
}

function resetProductForm() {
  rememberEditProduct("");
  clearFormDefaults();
  $("editProductId").value = "";
  $("editProductId").defaultValue = "";
  $("productForm").reset();
  state.editGallery = [];
  state.editGalleryEn = [];
  state.editGalleryActive = false;
  renderEditGallery("editGallery", "editGalleryList");
  renderEditGallery("editGalleryEn", "editGalleryEnList");
  const enBox = $("editEnBox");
  if (enBox) enBox.open = false;
  syncEditMode();
  $("productStatus").textContent = "";
  $("productStatus").className = "admin-status";
  const preview = $("prodImgPreview");
  if (preview) {
    preview.hidden = true;
    preview.removeAttribute("src");
  }
}

function fillProductForm(p) {
  const en = englishPackFor(p);
  $("editProductId").value = p.id;
  $("prodName").value = p.name || "";
  $("prodPrice").value = p.price || "";
  fillCategorySelect(p.categoryId || "");
  $("prodTag").value = p.tag || "";
  $("prodImg").value = p.img || "";
  if ($("prodImgCaption")) $("prodImgCaption").value = p.imgCaption || "";
  const preview = $("prodImgPreview");
  if (preview) {
    if (p.img) {
      preview.src = p.img;
      preview.hidden = false;
    } else {
      preview.hidden = true;
      preview.removeAttribute("src");
    }
  }
  $("prodDesc").value = p.desc || "";
  $("prodIntro").value = p.intro || "";
  $("prodFeatures").value = linesOf(p.features);
  $("prodPackage").value = linesOf(p.package);
  if ($("prodSpecs")) $("prodSpecs").value = pairsToText(p.specs);
  if ($("prodPins")) $("prodPins").value = pairsToText(p.pins);
  if ($("prodDownloads")) $("prodDownloads").value = downloadsToText(p.downloads);
  if ($("prodNameEn")) $("prodNameEn").value = en.name || "";
  if ($("prodTagEn")) $("prodTagEn").value = en.tag || "";
  if ($("prodDescEn")) $("prodDescEn").value = en.desc || "";
  if ($("prodIntroEn")) $("prodIntroEn").value = en.intro || "";
  if ($("prodFeaturesEn")) $("prodFeaturesEn").value = linesOf(en.features);
  if ($("prodPackageEn")) $("prodPackageEn").value = linesOf(en.package);
  if ($("prodSpecsEn")) $("prodSpecsEn").value = pairsToText(en.specs);
  if ($("prodPinsEn")) $("prodPinsEn").value = pairsToText(en.pins);
  const images = galleryItemsFrom(p.images && p.images.length ? p.images : p.img ? [{ url: p.img, caption: p.imgCaption || "" }] : []);
  state.editGallery = images;
  const enImages = galleryItemsFrom(en.images);
  const sameAsMain =
    enImages.length &&
    images.length === enImages.length &&
    images.every((item, index) => item.url === enImages[index].url);
  state.editGalleryEn = (sameAsMain ? [] : enImages).map((item) => ({
    ...item,
    captionEn: item.captionEn || item.caption || "",
  }));
  state.editGalleryActive = true;
  renderEditGallery("editGallery", "editGalleryList");
  renderEditGallery("editGalleryEn", "editGalleryEnList");
  const enBox = $("editEnBox");
  if (enBox) enBox.open = Boolean(state.editGalleryEn.length);
  rememberEditProduct(p.id);
  pinFormDefaults();
  syncEditMode();
  switchTab("products");
  const form = $("productForm");
  if (form) form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function collectEnglishPayload() {
  const en = {
    name: $("prodNameEn") ? $("prodNameEn").value.trim() : "",
    desc: $("prodDescEn") ? $("prodDescEn").value.trim() : "",
    tag: $("prodTagEn") ? $("prodTagEn").value.trim() : "",
    intro: $("prodIntroEn") ? $("prodIntroEn").value.trim() : "",
    features: textToLines($("prodFeaturesEn") ? $("prodFeaturesEn").value : ""),
    package: textToLines($("prodPackageEn") ? $("prodPackageEn").value : ""),
    specs: textToRows($("prodSpecsEn") ? $("prodSpecsEn").value : ""),
    pins: textToRows($("prodPinsEn") ? $("prodPinsEn").value : "", 3),
  };
  const images = (state.editGalleryEn || [])
    .filter((item) => item.url && !item.file)
    .map((item) => ({ url: item.url, caption: item.captionEn || item.caption || "" }));
  if (images.length) {
    en.images = images;
    en.img = images[0].url;
  }
  return en;
}

function fileToCompressedDataUrl(file, maxW = 900, quality = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve("");
      return;
    }
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, maxW / Math.max(image.width, 1));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image read failed"));
    };
    image.src = url;
  });
}

bindEditGallery("editGallery", "editGalleryList");
bindEditGallery("editGalleryEn", "editGalleryEnList");
const editGalleryFiles = $("editGalleryFiles");
if (editGalleryFiles) {
  editGalleryFiles.addEventListener("change", () => {
    addEditGalleryFiles("editGallery", "editGalleryList", editGalleryFiles.files);
    editGalleryFiles.value = "";
  });
}
const editGalleryEnFiles = $("editGalleryEnFiles");
if (editGalleryEnFiles) {
  editGalleryEnFiles.addEventListener("change", () => {
    addEditGalleryFiles("editGalleryEn", "editGalleryEnList", editGalleryEnFiles.files);
    editGalleryEnFiles.value = "";
    const enBox = $("editEnBox");
    if (enBox) enBox.open = true;
  });
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

function closePasswordDialog() {
  const overlay = $("passwordDialog");
  if (overlay) overlay.hidden = true;
  const form = $("passwordForm");
  if (form) form.reset();
  const status = $("passwordStatus");
  if (status) {
    status.textContent = "";
    status.className = "admin-status";
  }
}

function openPasswordDialog() {
  const overlay = $("passwordDialog");
  if (!overlay) return;
  closePasswordDialog();
  overlay.hidden = false;
  const current = $("pwdCurrent");
  if (current) current.focus();
}

$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const password = $("adminPassword").value.trim();
  setPass(password);
  try {
    await api("/api/admin/files");
    await recordAdminLogin("password");
    showPanel(true);
    switchTab("dashboard");
  } catch (err) {
    clearPass();
    alert("登录失败：" + err.message);
    return;
  }
  try {
    await loadAll();
    restoreProductEditor();
    startVisitLive();
  } catch (err) {
    alert("已登录，但部分数据没有加载出来：" + err.message);
  }
});

$("logoutBtn").addEventListener("click", () => {
  stopVisitLive();
  stopChatLive();
  clearPass();
  rememberEditProduct("");
  closePasswordDialog();
  showPanel(false);
});

if ($("passwordBtn")) {
  $("passwordBtn").addEventListener("click", () => openPasswordDialog());
}
if ($("passwordDialog")) {
  $("passwordDialog").addEventListener("click", (e) => {
    if (e.target.closest("[data-password-cancel]")) closePasswordDialog();
  });
}
if ($("passwordForm")) {
  $("passwordForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const status = $("passwordStatus");
    const currentPassword = ($("pwdCurrent").value || "").trim();
    const newPassword = ($("pwdNew").value || "").trim();
    const confirmPassword = ($("pwdNew2").value || "").trim();
    if (status) {
      status.textContent = "";
      status.className = "admin-status";
    }
    if (newPassword.length < 6) {
      if (status) {
        status.textContent = "新密码至少 6 位";
        status.className = "admin-status error";
      }
      return;
    }
    if (newPassword !== confirmPassword) {
      if (status) {
        status.textContent = "两次输入的新密码不一致";
        status.className = "admin-status error";
      }
      return;
    }
    try {
      await api("/api/admin/auth", {
        method: "POST",
        body: JSON.stringify({
          action: "change-password",
          currentPassword,
          newPassword,
        }),
      });
      setPass(newPassword);
      closePasswordDialog();
      await adminAlert("密码已更新，网页后台和客户端下次请使用新密码登录。", "修改成功");
    } catch (err) {
      if (status) {
        status.textContent = err.message || "修改失败";
        status.className = "admin-status error";
      }
    }
  });
}

$("adminDialogOk").addEventListener("click", () => closeAdminDialog(true));
$("adminDialog").addEventListener("click", (e) => {
  if (e.target.closest("[data-dialog-cancel]")) closeAdminDialog(false);
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  const pwd = $("passwordDialog");
  if (pwd && !pwd.hidden) {
    closePasswordDialog();
    return;
  }
  const overlay = $("adminDialog");
  if (!overlay || overlay.hidden) return;
  closeAdminDialog(false);
});

$("adminTabs").addEventListener("click", (e) => {
  const btn = e.target.closest(".admin-tab");
  if (!btn) return;
  switchTab(btn.dataset.tab);
});

$("refreshDashboard").addEventListener("click", () =>
  Promise.all([loadOrdersBundle(), loadVisits()]).catch((e) => alert(e.message))
);
$("refreshGeo").addEventListener("click", () =>
  loadOrdersBundle().catch((e) => alert(e.message))
);
$("clearGeo").addEventListener("click", () => {
  clearGeoHistory().catch((err) => adminAlert(err.message));
});
$("geoStatsTable").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-del-geo]");
  if (!btn) return;
  deleteGeoRow(btn.dataset.delGeo).catch((err) => adminAlert(err.message));
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden || !getPass()) return;
  if (state.currentTab === "dashboard" || state.currentTab === "geo") loadVisits().catch(() => {});
  if (state.currentTab === "orders") loadOrdersBundle().catch(() => {});
  if (state.currentTab === "chat") loadChatList().catch(() => {});
});
$("refreshOrders").addEventListener("click", () => loadOrdersBundle().catch((e) => alert(e.message)));
$("refreshCustomers").addEventListener("click", () => loadOrdersBundle().catch((e) => alert(e.message)));
$("refreshProducts").addEventListener("click", async (e) => {
  e.preventDefault();
  const editId = activeEditId();
  try {
    await loadProductsBundle();
    if (editId) {
      const nameGone = !$("prodName").value.trim();
      const idGone = !$("editProductId").value.trim();
      if (nameGone || idGone) {
        const product = allProducts().find((item) => String(item.id) === String(editId));
        if (product) fillProductForm(product);
        else $("editProductId").value = editId;
      }
      rememberEditProduct(editId);
    }
    syncEditMode();
  } catch (err) {
    alert(err.message);
  }
});
$("refreshUsers").addEventListener("click", () => loadUsers().catch((e) => alert(e.message)));
$("refreshUsersTop").addEventListener("click", () => loadUsers().catch((e) => adminAlert(e.message)));
$("clearUsers").addEventListener("click", () => {
  clearUsersHistory().catch((err) => adminAlert(err.message));
});
$("usersTable").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-del-user]");
  if (!btn) return;
  deleteUserRow(btn.dataset.delUser).catch((err) => adminAlert(err.message));
});
$("refreshLogins").addEventListener("click", () => loadLoginHistory().catch((e) => adminAlert(e.message)));
$("clearLogins").addEventListener("click", () => {
  clearLoginHistory().catch((err) => adminAlert(err.message));
});
$("loginsTable").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-del-login]");
  if (!btn) return;
  deleteLogin(btn.dataset.delLogin).catch((err) => adminAlert(err.message));
});
$("refreshChat").addEventListener("click", () => loadChatList().catch((e) => alert(e.message)));

$("autoReplyForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const status = $("autoReplyStatus");
  try {
    const data = await api("/api/admin/chat", {
      method: "POST",
      body: JSON.stringify({
        action: "settings",
        enabled: $("autoReplyEnabled").checked,
        message: $("autoReplyMessage").value,
      }),
    });
    state.autoReply = data.autoReply || state.autoReply;
    fillAutoReplyForm(state.autoReply);
    if (status) {
      status.className = "admin-status";
      status.textContent = data.autoReply && data.autoReply.enabled ? "已开启自动回复并保存到服务器" : "已关闭自动回复并保存到服务器";
    }
  } catch (err) {
    if (status) {
      status.className = "admin-status error";
      status.textContent = err.message;
    } else alert(err.message);
  }
});

$("adminChatList").addEventListener("click", (e) => {
  const del = e.target.closest("[data-del-thread]");
  if (del) {
    e.preventDefault();
    e.stopPropagation();
    removeChatThread(del.dataset.delThread).catch((err) => adminAlert(err.message));
    return;
  }
  const btn = e.target.closest("[data-chat-visitor]");
  if (!btn) return;
  openChatThread(btn.dataset.chatVisitor).catch((err) => adminAlert(err.message));
});

$("adminChatMsgs").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-del-msg]");
  if (!btn) return;
  deleteChatMessage(btn.dataset.delMsg).catch((err) => adminAlert(err.message));
});

$("clearChatThread").addEventListener("click", () => {
  clearChatThread().catch((err) => adminAlert(err.message));
});

$("deleteChatThread").addEventListener("click", () => {
  removeChatThread(state.activeChatVisitorId).catch((err) => adminAlert(err.message));
});

$("adminChatForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = $("adminChatInput").value.trim();
  if (!text || !state.activeChatVisitorId) return;
  try {
    $("adminChatSend").disabled = true;
    await api("/api/admin/chat", {
      method: "POST",
      body: JSON.stringify({ visitorId: state.activeChatVisitorId, text }),
    });
    $("adminChatInput").value = "";
    await openChatThread(state.activeChatVisitorId);
  } catch (err) {
    alert(err.message);
  } finally {
    $("adminChatSend").disabled = false;
  }
});

$("importLocalUsers").addEventListener("click", async () => {
  let local = [];
  try {
    local = JSON.parse(localStorage.getItem("shr_users_local") || "[]");
  } catch {
    local = [];
  }
  if (!local.length) {
    alert("本机没有可同步的注册账号。\n\n若是在手机上注册的：请用【同一部手机】打开后台，再点「同步本机注册」；或把手机上的同步码粘贴到上方导入。");
    return;
  }
  try {
    await api("/api/admin/users", {
      method: "POST",
      body: JSON.stringify({
        action: "import",
        users: local.map((u) => ({
          id: u.id,
          email: u.email,
          name: u.name,
          phone: u.phone,
          createdAt: u.createdAt,
          hash: u.hash,
          localHash: true,
          registerPlace: u.registerPlace || null,
        })),
      }),
    });
    await loadUsers();
    alert(`已同步 ${local.length} 个本机注册账号到后台`);
  } catch (err) {
    alert(err.message);
  }
});

$("importSyncCodeBtn").addEventListener("click", async () => {
  const code = ($("userSyncCode").value || "").trim();
  if (!code) {
    alert("请先粘贴手机上的同步码");
    return;
  }
  let users = [];
  try {
    if (window.Auth && window.Auth.parseSyncCode) users = window.Auth.parseSyncCode(code);
    else {
      const text = decodeURIComponent(escape(atob(code)));
      const data = JSON.parse(text);
      users = data.users || [];
    }
  } catch (err) {
    alert("同步码无效，请重新复制");
    return;
  }
  if (!users.length) {
    alert("同步码里没有用户");
    return;
  }
  try {
    await api("/api/admin/users", {
      method: "POST",
      body: JSON.stringify({ action: "import", users }),
    });
    $("userSyncCode").value = "";
    await loadUsers();
    alert(`已导入 ${users.length} 个注册账号`);
  } catch (err) {
    alert(err.message);
  }
});
$("refreshDocs").addEventListener("click", () => refreshList().catch((e) => alert(e.message)));

$("productResetBtn").addEventListener("click", async () => {
  if (!(await adminConfirm("确定清空产品表单中已填写的内容？未保存的修改会丢失。", "清空表单"))) return;
  resetProductForm();
});

const prodImgFile = $("prodImgFile");
if (prodImgFile) {
  prodImgFile.addEventListener("change", () => {
    const file = prodImgFile.files && prodImgFile.files[0];
    const preview = $("prodImgPreview");
    if (!preview) return;
    if (!file) {
      preview.hidden = true;
      return;
    }
    preview.src = URL.createObjectURL(file);
    preview.hidden = false;
  });
}

$("productForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const status = $("productStatus");
  status.textContent = "保存中…";
  status.className = "admin-status";
  const editId = activeEditId();
  const file = $("prodImgFile") && $("prodImgFile").files ? $("prodImgFile").files[0] : null;
  const typedUrl = $("prodImg").value.trim();
  const typedCaption = $("prodImgCaption") ? $("prodImgCaption").value.trim() : "";
  if (file) {
    state.editGallery.unshift({
      key: "cover-" + Date.now(),
      id: "",
      url: "",
      caption: typedCaption,
      captionEn: "",
      file,
    });
    state.editGalleryActive = true;
  } else if (typedUrl) {
    if (!state.editGallery.length) {
      state.editGallery = [
        { key: "cover-url", id: typedUrl, url: typedUrl, caption: typedCaption, captionEn: "", file: null },
      ];
      state.editGalleryActive = true;
    } else if (!state.editGallery[0].file && state.editGallery[0].url !== typedUrl) {
      state.editGallery[0].url = typedUrl;
      state.editGallery[0].id = typedUrl;
      state.editGalleryActive = true;
    }
    if (state.editGallery[0] && !state.editGallery[0].caption) state.editGallery[0].caption = typedCaption;
  }
  const payload = {
    action: editId ? "update" : "create",
    id: editId || undefined,
    name: $("prodName").value.trim(),
    price: $("prodPrice").value,
    categoryId: $("prodCategory").value,
    category: ($("prodCategory").selectedOptions[0] && $("prodCategory").selectedOptions[0].textContent) || "",
    tag: $("prodTag").value.trim(),
    img: typedUrl,
    imgCaption: typedCaption,
    imageBase64: "",
    imageType: "image/jpeg",
    desc: $("prodDesc").value.trim(),
    intro: $("prodIntro").value.trim(),
    features: textToLines($("prodFeatures").value),
    package: textToLines($("prodPackage").value),
    specs: textToRows($("prodSpecs") ? $("prodSpecs").value : ""),
    pins: textToRows($("prodPins") ? $("prodPins").value : "", 3),
    downloads: textToDownloads($("prodDownloads") ? $("prodDownloads").value : ""),
    en: collectEnglishPayload(),
    seedIds: state.seedProducts.map((p) => p.id),
  };
  try {
    const saved = await api("/api/admin/products", { method: "POST", body: JSON.stringify(payload) });
    const productId = (saved.product && saved.product.id) || editId;
    if (productId && state.editGalleryActive) {
      status.textContent = "正在保存图片…";
      await syncProductImages(productId);
    }
    status.textContent = editId ? "已保存" : "产品已上传";
    resetProductForm();
    await loadProductsBundle();
  } catch (err) {
    status.textContent = "失败：" + err.message;
    status.className = "admin-status error";
  }
});

async function uploadEditFiles(productId, items) {
  const ready = [];
  for (const item of items) {
    let url = item.url;
    let id = item.id;
    if (item.file) {
      const imageBase64 = await fileToCompressedDataUrl(item.file);
      const data = await api("/api/admin/products", {
        method: "POST",
        body: JSON.stringify({
          action: "gallery-add",
          id: productId,
          images: [{ imageBase64, imageType: "image/jpeg", caption: item.caption, captionEn: item.captionEn }],
        }),
      });
      const last = (data.images || [])[data.images.length - 1];
      if (!last || !last.url) throw new Error("图片没有保存成功");
      url = last.url;
      id = last.id || last.url;
    }
    if (!url || String(url).indexOf("blob:") === 0) continue;
    ready.push({
      id: id || url,
      url,
      caption: item.caption || "",
      captionEn: item.captionEn || "",
    });
  }
  return ready;
}

async function syncProductImages(productId) {
  const images = await uploadEditFiles(productId, state.editGallery || []);
  const enImages = await uploadEditFiles(productId, state.editGalleryEn || []);
  const data = await api("/api/admin/products", {
    method: "POST",
    body: JSON.stringify({ action: "gallery-set", id: productId, images }),
  });
  const patch = {
    action: "update",
    id: productId,
    name: $("prodName").value.trim(),
    price: $("prodPrice").value,
    categoryId: $("prodCategory").value,
    desc: $("prodDesc").value.trim(),
  };
  if (images[0] && images[0].url) {
    patch.img = images[0].url;
    patch.imgCaption = images[0].caption || "";
  }
  if (enImages.length) {
    patch.en = {
      images: enImages.map((item) => ({ url: item.url, caption: item.captionEn || item.caption || "" })),
      img: enImages[0].url,
    };
  }
  if (patch.img || patch.en) {
    await api("/api/admin/products", { method: "POST", body: JSON.stringify(patch) });
  }
  if (data.images) state.galleries[String(productId)] = data.images;
}

function selectedProductIds() {
  return Array.from(document.querySelectorAll(".product-check:checked")).map((el) => el.value);
}

async function setSelectedHidden(hidden) {
  const ids = selectedProductIds();
  const hint = $("productBatchStatus");
  if (!ids.length) {
    if (hint) hint.textContent = "请先勾选要操作的产品";
    return;
  }
  try {
    if (hint) hint.textContent = hidden ? "下架中…" : "上架中…";
    await api("/api/admin/products", {
      method: "POST",
      body: JSON.stringify({ action: hidden ? "hide" : "show", ids }),
    });
    await loadProductsBundle();
    if (hint) hint.textContent = hidden ? `已下架 ${ids.length} 件` : `已上架 ${ids.length} 件`;
  } catch (err) {
    if (hint) hint.textContent = err.message;
    else alert(err.message);
  }
}

$("selectAllProducts").addEventListener("change", () => {
  const on = $("selectAllProducts").checked;
  document.querySelectorAll(".product-check").forEach((el) => {
    el.checked = on;
  });
});

$("hideSelectedProducts").addEventListener("click", () => setSelectedHidden(true));
$("showSelectedProducts").addEventListener("click", () => setSelectedHidden(false));

async function deleteSelectedProducts(ids) {
  const hint = $("productBatchStatus");
  const list = (ids || []).map(String).filter(Boolean);
  if (!list.length) {
    if (hint) hint.textContent = "请先勾选要删除的产品";
    return;
  }
  if (!(await adminConfirm(`确定删除选中的 ${list.length} 件产品？删除后商城不再显示。`, "删除产品"))) return;
  try {
    if (hint) hint.textContent = "删除中…";
    await api("/api/admin/products", {
      method: "POST",
      body: JSON.stringify({ action: "delete", ids: list }),
    });
    if (list.includes(String(state.galleryProductId))) renderGalleryPanel("");
    await loadProductsBundle();
    if (hint) hint.textContent = `已删除 ${list.length} 件`;
  } catch (err) {
    if (hint) hint.textContent = err.message;
    else alert(err.message);
  }
}

$("deleteSelectedProducts").addEventListener("click", () => deleteSelectedProducts(selectedProductIds()));

$("categoryAddBtn").addEventListener("click", async () => {
  const status = $("categoryStatus");
  const nameEl = $("categoryName");
  const descEl = $("categoryDesc");
  const name = nameEl ? nameEl.value.trim() : "";
  if (!name) {
    if (status) {
      status.className = "admin-status error";
      status.textContent = "请填写分类名称";
    }
    return;
  }
  try {
    if (status) {
      status.className = "admin-status";
      status.textContent = "保存中…";
    }
    await api("/api/admin/products", {
      method: "POST",
      body: JSON.stringify({
        action: "category-add",
        name,
        desc: descEl ? descEl.value.trim() : "",
      }),
    });
    if (nameEl) nameEl.value = "";
    if (descEl) descEl.value = "";
    await loadProductsBundle();
    if (status) status.textContent = "分类已添加";
  } catch (err) {
    if (status) {
      status.className = "admin-status error";
      status.textContent = err.message;
    }
  }
});

$("categoriesTable").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-del-category]");
  if (!btn) return;
  const id = btn.dataset.delCategory;
  const cat = (state.categories || []).find((c) => c.id === id);
  const label = cat ? cat.name : id;
  if (!(await adminConfirm(`确定删除分类「${label}」？商城将不再显示该分类，其下商品仍会出现在「全部」中。`, "删除分类"))) {
    return;
  }
  const status = $("categoryStatus");
  try {
    await api("/api/admin/products", {
      method: "POST",
      body: JSON.stringify({ action: "category-remove", id }),
    });
    await loadProductsBundle();
    if (status) {
      status.className = "admin-status";
      status.textContent = "分类已删除";
    }
  } catch (err) {
    if (status) {
      status.className = "admin-status error";
      status.textContent = err.message;
    } else {
      adminAlert(err.message);
    }
  }
});

$("gallerySelectedProduct").addEventListener("click", () => {
  const ids = selectedProductIds();
  const hint = $("productBatchStatus");
  if (ids.length !== 1) {
    if (hint) hint.textContent = "请只勾选一件商品，再上传宣传图";
    return;
  }
  if (hint) hint.textContent = "";
  renderGalleryPanel(ids[0]);
  $("galleryCard").scrollIntoView({ behavior: "smooth", block: "start" });
});

$("galleryCloseBtn").addEventListener("click", () => renderGalleryPanel(""));

$("galleryUploadBtn").addEventListener("click", async () => {
  const status = $("galleryStatus");
  const input = $("galleryFiles");
  const id = state.galleryProductId;
  if (!id) {
    if (status) status.textContent = "请先选择一件商品";
    return;
  }
  const files = input && input.files ? Array.from(input.files) : [];
  if (!files.length) {
    if (status) status.textContent = "请选择至少一张图片";
    return;
  }
  const existing = (state.galleries[id] || []).length;
  const room = Math.max(0, 12 - existing);
  if (!room) {
    if (status) status.textContent = "已满 12 张，请先删除再上传";
    return;
  }
  try {
    if (status) {
      status.className = "admin-status";
      status.textContent = "上传中…";
    }
    const slice = files.slice(0, room);
    const caption = $("galleryCaption") ? $("galleryCaption").value.trim() : "";
    for (let i = 0; i < slice.length; i++) {
      const imageBase64 = await fileToCompressedDataUrl(slice[i]);
      const data = await api("/api/admin/products", {
        method: "POST",
        body: JSON.stringify({
          action: "gallery-add",
          id,
          images: [{ imageBase64, imageType: "image/jpeg", caption }],
        }),
      });
      if (data.images) state.galleries[id] = data.images;
      if (status) status.textContent = `已上传 ${i + 1}/${slice.length}`;
    }
    if (input) input.value = "";
    if ($("galleryCaption")) $("galleryCaption").value = "";
    await loadProductsBundle();
    if (status) status.textContent = `宣传图已保存，共 ${(state.galleries[id] || []).length} 张`;
  } catch (err) {
    if (status) {
      status.className = "admin-status error";
      status.textContent = "上传失败：" + err.message;
    }
  }
});

$("galleryList").addEventListener("click", async (e) => {
  const saveBtn = e.target.closest("[data-save-gallery-caption]");
  if (saveBtn && state.galleryProductId) {
    const status = $("galleryStatus");
    const box = saveBtn.closest(".admin-gallery-item");
    const ta = box && box.querySelector("[data-gallery-caption]");
    try {
      const data = await api("/api/admin/products", {
        method: "POST",
        body: JSON.stringify({
          action: "gallery-caption",
          id: state.galleryProductId,
          imageId: saveBtn.dataset.saveGalleryCaption,
          caption: ta ? ta.value : "",
        }),
      });
      if (data.images) state.galleries[state.galleryProductId] = data.images;
      await loadProductsBundle();
      if (status) {
        status.className = "admin-status";
        status.textContent = "图片说明已保存";
      }
    } catch (err) {
      if (status) {
        status.className = "admin-status error";
        status.textContent = "保存说明失败：" + err.message;
      }
    }
    return;
  }
  const btn = e.target.closest("[data-del-gallery]");
  if (!btn || !state.galleryProductId) return;
  if (!(await adminConfirm("确定删除这张宣传图？删除后商品详情页不再显示。", "删除宣传图"))) return;
  try {
    const data = await api("/api/admin/products", {
      method: "POST",
      body: JSON.stringify({
        action: "gallery-remove",
        id: state.galleryProductId,
        imageId: btn.dataset.delGallery,
      }),
    });
    if (data.images) state.galleries[state.galleryProductId] = data.images;
    await loadProductsBundle();
  } catch (err) {
    alert(err.message);
  }
});

$("productsTable").addEventListener("click", async (e) => {
  const galleryBtn = e.target.closest("[data-gallery-product]");
  if (galleryBtn) {
    renderGalleryPanel(galleryBtn.dataset.galleryProduct);
    $("galleryCard").scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  const toggleBtn = e.target.closest("[data-toggle-hidden]");
  if (toggleBtn) {
    const id = toggleBtn.dataset.toggleHidden;
    const hidden = toggleBtn.dataset.hidden !== "1";
    try {
      await api("/api/admin/products", {
        method: "POST",
        body: JSON.stringify({ action: hidden ? "hide" : "show", ids: [id] }),
      });
      await loadProductsBundle();
    } catch (err) {
      alert(err.message);
    }
    return;
  }
  const editBtn = e.target.closest("[data-edit-product]");
  if (editBtn) {
    const p = allProducts().find((x) => String(x.id) === String(editBtn.dataset.editProduct));
    if (p) fillProductForm(p);
    return;
  }
  const delBtn = e.target.closest("[data-del-product]");
  if (!delBtn) return;
  deleteSelectedProducts([delBtn.dataset.delProduct]);
});

$("ordersTable").addEventListener("click", (e) => {
  const shipBtn = e.target.closest("[data-ship-order]");
  if (shipBtn) {
    markOrderShipped(shipBtn.dataset.shipOrder);
    return;
  }
  const row = e.target.closest("[data-order-id]");
  if (!row) return;
  const order = state.orders.find((o) => String(o.id) === String(row.dataset.orderId));
  showOrderDetail(order);
});

const shipAlert = $("shipAlert");
if (shipAlert) {
  shipAlert.addEventListener("click", (e) => {
    const shipBtn = e.target.closest("[data-ship-order]");
    if (shipBtn) {
      markOrderShipped(shipBtn.dataset.shipOrder);
      return;
    }
    const openBtn = e.target.closest("[data-open-order]");
    if (!openBtn) return;
    const order = state.orders.find((o) => String(o.id) === String(openBtn.dataset.openOrder));
    showOrderDetail(order);
    const row = Array.from(document.querySelectorAll("#ordersTable [data-order-id]")).find(
      (el) => String(el.dataset.orderId) === String(openBtn.dataset.openOrder)
    );
    if (row) row.scrollIntoView({ block: "center", behavior: "smooth" });
  });
}

const orderDetail = $("orderDetail");
if (orderDetail) {
  orderDetail.addEventListener("click", (e) => {
    const shipBtn = e.target.closest("[data-ship-order]");
    if (shipBtn) markOrderShipped(shipBtn.dataset.shipOrder);
  });
}

$("importLocalOrders").addEventListener("click", async () => {
  let local = [];
  try {
    local = JSON.parse(localStorage.getItem(ORDERS_KEY) || "[]");
  } catch {
    local = [];
  }
  if (!local.length) {
    alert("本机没有可同步的订单");
    return;
  }
  try {
    await api("/api/admin/orders", {
      method: "POST",
      body: JSON.stringify({ action: "import", orders: local }),
    });
    await loadOrdersBundle();
    alert(`已同步 ${local.length} 条本机订单`);
  } catch (err) {
    alert(err.message);
  }
});

$("uploadForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const status = $("uploadStatus");
  const file = $("fileInput").files[0];
  if (!file) return;

  const ext = (file.name.match(/\.[a-z0-9]+$/i) || [""])[0].toLowerCase();
  if (![".zip", ".rar", ".7z"].includes(ext)) {
    status.textContent = "仅支持 zip / rar / 7z";
    status.className = "admin-status error";
    return;
  }

  status.textContent = "上传中…";
  status.className = "admin-status";
  try {
    const contentBase64 = await fileToBase64(file);
    const displayName = $("displayName").value.trim() || file.name;
    await api("/api/admin/upload", {
      method: "POST",
      body: JSON.stringify({
        password: getPass(),
        productId: $("productId").value,
        fileName: file.name,
        displayName,
        displayNameEn: displayName,
        contentBase64,
      }),
    });
    status.textContent = "上传成功";
    $("fileInput").value = "";
    $("displayName").value = "";
    await refreshList();
  } catch (err) {
    status.textContent = "上传失败：" + err.message;
    status.className = "admin-status error";
  }
});

$("fileList").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-del-id]");
  if (!btn) return;
  if (!(await adminConfirm("确定删除该资料登记？", "删除资料"))) return;
  try {
    await api("/api/admin/files", {
      method: "POST",
      body: JSON.stringify({
        action: "delete",
        password: getPass(),
        productId: btn.dataset.delDocProduct,
        fileId: btn.dataset.delId,
      }),
    });
    await refreshList();
  } catch (err) {
    alert(err.message);
  }
});

function bindPasswordToggles() {
  document.querySelectorAll("[data-password-toggle]").forEach((btn) => {
    if (btn.dataset.boundToggle) return;
    btn.dataset.boundToggle = "1";
    btn.addEventListener("click", () => {
      const wrap = btn.closest(".password-field");
      const input = wrap && wrap.querySelector("input");
      if (!input) return;
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      wrap.classList.toggle("is-visible", show);
      btn.setAttribute("aria-pressed", show ? "true" : "false");
      btn.setAttribute("aria-label", show ? "隐藏密码" : "显示密码");
    });
  });
}

window.addEventListener("resize", () => {
  if (geoMap && typeof geoMap.updateSize === "function") geoMap.updateSize();
});

document.addEventListener("DOMContentLoaded", async () => {
  bindPasswordToggles();
  state.seedProducts = Array.isArray(window.PRODUCTS) ? window.PRODUCTS.slice() : [];
  productOptions();
  if (!getPass()) {
    showPanel(false);
    return;
  }
  try {
    await api("/api/admin/files");
    await recordAdminLogin("auto");
    showPanel(true);
    switchTab("dashboard");
    await loadAll();
    restoreProductEditor();
    startVisitLive();
  } catch {
    clearPass();
    showPanel(false);
  }
});
