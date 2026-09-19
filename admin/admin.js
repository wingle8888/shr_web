const PASS_KEY = "shr_admin_pass";
const ORDERS_KEY = "shr_orders";

const state = {
  seedProducts: [],
  customProducts: [],
  hiddenIds: [],
  deletedIds: [],
  galleries: {},
  galleryProductId: "",
  orders: [],
  customers: [],
  addressStats: [],
  users: [],
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
    if (titleEl) titleEl.textContent = title || "请确认";
    if (msgEl) msgEl.textContent = message || "";
    if (okBtn) okBtn.textContent = okText || "确定";
    if (cancelBtn) {
      cancelBtn.textContent = cancelText || "取消";
      cancelBtn.hidden = showCancel === false;
    }
    overlay.hidden = false;
    if (okBtn) okBtn.focus();
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
}

function switchTab(tab) {
  state.currentTab = tab;
  document.querySelectorAll(".admin-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });
  document.querySelectorAll(".admin-tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `tab-${tab}`);
  });
  if (tab === "dashboard" && getPass()) {
    loadVisits().catch(() => {});
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
      <div class="admin-stat-sub">UV ${today.uv || 0} · ${escapeHtml(today.day || "今日")}</div>
    </div>
    <div class="admin-stat-card">
      <div class="admin-stat-label">本月访问</div>
      <div class="admin-stat-value">${monthV.pv || 0}</div>
      <div class="admin-stat-sub">UV ${monthV.uv || 0} · ${escapeHtml(monthV.month || "本月")}</div>
    </div>
    <div class="admin-stat-card">
      <div class="admin-stat-label">本月销售额</div>
      <div class="admin-stat-value">¥${formatMoney(tm.amount)}</div>
      <div class="admin-stat-sub">${escapeHtml(tm.month || "-")} · 订单 ${tm.orders || 0}</div>
    </div>
    <div class="admin-stat-card">
      <div class="admin-stat-label">累计销售额</div>
      <div class="admin-stat-value">¥${formatMoney(stats.totalAmount)}</div>
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
        <td>¥${formatMoney(m.amount)}</td>
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
            label: "日 PV",
            data: daily.length ? daily.map((d) => d.pv) : [0],
            borderColor: "#2ee6ff",
            backgroundColor: "rgba(46, 230, 255, 0.18)",
            fill: true,
            tension: 0.35,
            pointRadius: 2,
          },
          {
            label: "日 UV",
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
            label: "月 PV",
            data: monthly.length ? monthly.map((m) => m.pv) : [0],
            backgroundColor: "rgba(46, 230, 255, 0.55)",
            borderRadius: 6,
          },
          {
            label: "月 UV",
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

function renderProductsTable() {
  const tbody = $("productsTable").querySelector("tbody");
  const list = allProducts();
  const allBox = $("selectAllProducts");
  if (allBox) allBox.checked = false;
  tbody.innerHTML = list.length
    ? list
        .map((p) => {
          const custom = p.source === "custom";
          const img = p.img ? `<img class="admin-thumb" src="${escapeHtml(p.img)}" alt="">` : "";
          const status = p.hidden
            ? `<span class="admin-pill off">已下架</span>`
            : `<span class="admin-pill on">在售</span>`;
          return `<tr class="${p.hidden ? "is-hidden-product" : ""}">
        <td><input type="checkbox" class="product-check" value="${escapeHtml(String(p.id))}"></td>
        <td>${img}</td>
        <td>${p.id}</td>
        <td>${escapeHtml(p.name)}</td>
        <td>${escapeHtml(p.category || p.categoryId || "")}</td>
        <td>¥${formatMoney(p.price)}</td>
        <td>${status}</td>
        <td>${custom ? "后台上传" : "商城预设"}</td>
        <td class="admin-row-actions">
          <button type="button" data-gallery-product="${p.id}">宣传图</button>
          <button type="button" data-toggle-hidden="${p.id}" data-hidden="${p.hidden ? "1" : "0"}">${
            p.hidden ? "上架" : "下架"
          }</button>
          ${custom ? `<button type="button" data-edit-product="${p.id}">编辑</button>` : ""}
          <button type="button" class="danger" data-del-product="${p.id}">删除</button>
        </td>
      </tr>`;
        })
        .join("")
    : `<tr><td colspan="9" class="admin-empty">暂无产品</td></tr>`;
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
        .map(
          (img) => `<div class="admin-gallery-item">
      <img src="${escapeHtml(img.url)}" alt="">
      <button type="button" class="danger" data-del-gallery="${escapeHtml(img.id)}">删除</button>
    </div>`
        )
        .join("")
    : `<p class="admin-tip">还没有宣传图，请选择多张图片后上传。</p>`;
}

function renderOrders() {
  const tbody = $("ordersTable").querySelector("tbody");
  const list = state.orders || [];
  tbody.innerHTML = list.length
    ? list
        .map((o) => {
          const s = o.shipping || {};
          const addr = [s.region, s.address].filter(Boolean).join(" ") || "-";
          return `<tr data-order-id="${escapeHtml(o.id)}" class="admin-click-row">
        <td>${escapeHtml(o.id)}</td>
        <td>${escapeHtml(formatTime(o.createdAt))}</td>
        <td>${escapeHtml(s.name || "-")}</td>
        <td>${escapeHtml(s.phone || "-")}</td>
        <td class="admin-addr-cell" title="${escapeHtml(addr)}">${escapeHtml(addr)}</td>
        <td>¥${formatMoney(o.total)}</td>
        <td>${escapeHtml(o.status || "-")}</td>
        <td>${escapeHtml(o.payMethod || "-")}</td>
      </tr>`;
        })
        .join("")
    : `<tr><td colspan="8" class="admin-empty">暂无订单</td></tr>`;
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
        <td>¥${formatMoney(row.amount)}</td>
        <td>${escapeHtml(row.sampleNames || "-")}</td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="6" class="admin-empty">暂无地址统计（有订单后按收货地址汇总）</td></tr>`;
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
    .map((i) => `<li>${escapeHtml(i.name)} × ${i.qty}　¥${formatMoney((i.price || 0) * (i.qty || 0))}</li>`)
    .join("");
  box.hidden = false;
  box.innerHTML = `
    <h3>订单详情 ${escapeHtml(order.id)}</h3>
    <p>收货：${escapeHtml(s.name || "")} · ${escapeHtml(s.phone || "")} · ${escapeHtml(s.email || "")}</p>
    <p>地址：${escapeHtml(s.region || "")} ${escapeHtml(s.address || "")}</p>
    <p>支付：${escapeHtml(order.payMethod || "-")} · 状态：${escapeHtml(order.status || "-")}</p>
    ${order.userEmail ? `<p>关联账号：${escapeHtml(order.userEmail)}</p>` : ""}
    <ul>${items}</ul>
    <p><strong>合计 ¥${formatMoney(order.total)}</strong></p>
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
        <td>¥${formatMoney(c.totalSpent)}</td>
        <td>${escapeHtml(c.lastOrderId || "-")}<br><span class="admin-muted">${escapeHtml(
            formatTime(c.lastOrderAt)
          )}</span></td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="8" class="admin-empty">暂无客户资料</td></tr>`;
}

function renderUsers() {
  const tbody = $("usersTable").querySelector("tbody");
  const list = state.users || [];
  const tip = $("usersStorageTip");
  const statusEl = $("usersStorageStatus");
  if (tip) {
    tip.textContent = state.usersStorageOk
      ? "注册成功后资料保存在服务器；打开后台会自动从服务器下载显示。"
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
          return `<tr>
        <td>${escapeHtml(u.id)}</td>
        <td>${escapeHtml(u.name || "-")}</td>
        <td>${escapeHtml(u.email || "-")}</td>
        <td>${escapeHtml(u.phone || "-")}</td>
        <td>${escapeHtml(place)}</td>
        <td>${escapeHtml(formatTime(u.createdAt))}</td>
        <td>${escapeHtml(source)}</td>
      </tr>`;
        })
        .join("")
    : `<tr><td colspan="7" class="admin-empty">服务器暂无注册用户</td></tr>`;
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
  if (data.visits) state.visits = data.visits;
  renderStats();
  renderOrders();
  renderAddressStats();
  renderCustomers();
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
    if (state.currentTab === "dashboard") loadVisits().catch(() => {});
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
  renderStats();
}

async function loadProductsBundle() {
  const data = await api("/api/admin/products");
  state.customProducts = data.products || [];
  state.hiddenIds = data.hiddenIds || [];
  state.deletedIds = data.deletedIds || [];
  state.galleries = data.galleries || {};
  renderProductsTable();
  productOptions();
  if (state.galleryProductId) renderGalleryPanel(state.galleryProductId);
}

async function loadUsers() {
  const data = await api("/api/admin/users");
  state.users = data.users || [];
  state.usersStorage = data.storage || "ephemeral";
  state.usersStorageOk = data.storage === "blob" || data.storage === "local";
  state.usersStorageMessage = data.storageMessage || "";
  renderUsers();
  renderStats();
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
  ];
  const results = await Promise.allSettled(tasks);
  const failed = results.slice(0, 5).find((r) => r.status === "rejected");
  if (failed) throw failed.reason;
}

function resetProductForm() {
  $("editProductId").value = "";
  $("productForm").reset();
  $("productSubmitBtn").textContent = "上传产品";
  $("productStatus").textContent = "";
  $("productStatus").className = "admin-status";
  const preview = $("prodImgPreview");
  if (preview) {
    preview.hidden = true;
    preview.removeAttribute("src");
  }
}

function fillProductForm(p) {
  $("editProductId").value = p.id;
  $("prodName").value = p.name || "";
  $("prodPrice").value = p.price || "";
  $("prodCategory").value = p.categoryId || "cat-mcu";
  $("prodTag").value = p.tag || "";
  $("prodImg").value = p.img || "";
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
  $("prodFeatures").value = (p.features || []).join("\n");
  $("prodPackage").value = (p.package || []).join("\n");
  $("productSubmitBtn").textContent = "保存修改";
  switchTab("products");
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

$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const password = $("adminPassword").value.trim();
  setPass(password);
  try {
    await api("/api/admin/files");
    showPanel(true);
    switchTab("dashboard");
    await loadAll();
    startVisitLive();
  } catch (err) {
    clearPass();
    alert("登录失败：" + err.message);
  }
});

$("logoutBtn").addEventListener("click", () => {
  stopVisitLive();
  stopChatLive();
  clearPass();
  showPanel(false);
});

$("adminDialogOk").addEventListener("click", () => closeAdminDialog(true));
$("adminDialog").addEventListener("click", (e) => {
  if (e.target.closest("[data-dialog-cancel]")) closeAdminDialog(false);
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
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

document.addEventListener("visibilitychange", () => {
  if (document.hidden || !getPass()) return;
  if (state.currentTab === "dashboard") loadVisits().catch(() => {});
  if (state.currentTab === "chat") loadChatList().catch(() => {});
});
$("refreshOrders").addEventListener("click", () => loadOrdersBundle().catch((e) => alert(e.message)));
$("refreshCustomers").addEventListener("click", () => loadOrdersBundle().catch((e) => alert(e.message)));
$("refreshProducts").addEventListener("click", () => loadProductsBundle().catch((e) => alert(e.message)));
$("refreshUsers").addEventListener("click", () => loadUsers().catch((e) => alert(e.message)));
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

$("productResetBtn").addEventListener("click", resetProductForm);

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
  const editId = $("editProductId").value.trim();
  const file = $("prodImgFile") && $("prodImgFile").files ? $("prodImgFile").files[0] : null;
  let imageBase64 = "";
  if (file) {
    try {
      imageBase64 = await fileToCompressedDataUrl(file);
    } catch (err) {
      status.textContent = "图片读取失败：" + err.message;
      status.className = "admin-status error";
      return;
    }
  }
  const payload = {
    action: editId ? "update" : "create",
    id: editId || undefined,
    name: $("prodName").value.trim(),
    price: $("prodPrice").value,
    categoryId: $("prodCategory").value,
    tag: $("prodTag").value.trim(),
    img: $("prodImg").value.trim(),
    imageBase64,
    imageType: "image/jpeg",
    desc: $("prodDesc").value.trim(),
    intro: $("prodIntro").value.trim(),
    featuresText: $("prodFeatures").value,
    packageText: $("prodPackage").value,
    seedIds: state.seedProducts.map((p) => p.id),
  };
  try {
    await api("/api/admin/products", { method: "POST", body: JSON.stringify(payload) });
    status.textContent = editId ? "已保存" : "产品已上传";
    resetProductForm();
    await loadProductsBundle();
  } catch (err) {
    status.textContent = "失败：" + err.message;
    status.className = "admin-status error";
  }
});

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
    for (let i = 0; i < slice.length; i++) {
      const imageBase64 = await fileToCompressedDataUrl(slice[i]);
      const data = await api("/api/admin/products", {
        method: "POST",
        body: JSON.stringify({
          action: "gallery-add",
          id,
          images: [{ imageBase64, imageType: "image/jpeg" }],
        }),
      });
      if (data.images) state.galleries[id] = data.images;
      if (status) status.textContent = `已上传 ${i + 1}/${slice.length}`;
    }
    if (input) input.value = "";
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
  const btn = e.target.closest("[data-del-gallery]");
  if (!btn || !state.galleryProductId) return;
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
    const p = state.customProducts.find((x) => String(x.id) === String(editBtn.dataset.editProduct));
    if (p) fillProductForm(p);
    return;
  }
  const delBtn = e.target.closest("[data-del-product]");
  if (!delBtn) return;
  deleteSelectedProducts([delBtn.dataset.delProduct]);
});

$("ordersTable").addEventListener("click", (e) => {
  const row = e.target.closest("[data-order-id]");
  if (!row) return;
  const order = state.orders.find((o) => String(o.id) === String(row.dataset.orderId));
  showOrderDetail(order);
});

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

document.addEventListener("DOMContentLoaded", async () => {
  state.seedProducts = Array.isArray(window.PRODUCTS) ? window.PRODUCTS.slice() : [];
  productOptions();
  if (!getPass()) {
    showPanel(false);
    return;
  }
  try {
    await api("/api/admin/files");
    showPanel(true);
    switchTab("dashboard");
    await loadAll();
    startVisitLive();
  } catch {
    clearPass();
    showPanel(false);
  }
});
