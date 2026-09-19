const PASS_KEY = "shr_admin_pass";
const ORDERS_KEY = "shr_orders";

const state = {
  seedProducts: [],
  customProducts: [],
  orders: [],
  customers: [],
  addressStats: [],
  users: [],
  stats: null,
  visits: null,
  currentTab: "dashboard",
};

let dailyVisitChart = null;
let monthlyVisitChart = null;

function $(id) {
  return document.getElementById(id);
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
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

function allProducts() {
  const map = new Map();
  state.seedProducts.forEach((p) => map.set(String(p.id), { ...p, source: "seed" }));
  state.customProducts.forEach((p) => map.set(String(p.id), { ...p, source: "custom" }));
  return Array.from(map.values()).sort((a, b) => Number(a.id) - Number(b.id));
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
  tbody.innerHTML = list.length
    ? list
        .map((p) => {
          const custom = p.source === "custom";
          return `<tr>
        <td>${p.id}</td>
        <td>${escapeHtml(p.name)}</td>
        <td>${escapeHtml(p.category || p.categoryId || "")}</td>
        <td>¥${formatMoney(p.price)}</td>
        <td>${custom ? "后台上传" : "商城预设"}</td>
        <td class="admin-row-actions">
          ${
            custom
              ? `<button type="button" data-edit-product="${p.id}">编辑</button>
                 <button type="button" class="danger" data-del-product="${p.id}">删除</button>`
              : `<span class="admin-muted">只读</span>`
          }
        </td>
      </tr>`;
        })
        .join("")
    : `<tr><td colspan="6" class="admin-empty">暂无产品</td></tr>`;
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
  tbody.innerHTML = list.length
    ? list
        .map(
          (u) => `<tr>
        <td>${escapeHtml(u.id)}</td>
        <td>${escapeHtml(u.name || "-")}</td>
        <td>${escapeHtml(u.email || "-")}</td>
        <td>${escapeHtml(u.phone || "-")}</td>
        <td>${escapeHtml(formatTime(u.createdAt))}</td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="5" class="admin-empty">暂无注册用户</td></tr>`;
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

async function loadVisits() {
  /* 访问统计已由 /api/admin/orders 一并返回 */
  renderStats();
}

async function loadProductsBundle() {
  const data = await api("/api/admin/products");
  state.customProducts = data.products || [];
  renderProductsTable();
  productOptions();
}

async function loadUsers() {
  const data = await api("/api/admin/users");
  state.users = data.users || [];
  renderUsers();
  renderStats();
}

async function loadAll() {
  const tasks = [
    loadOrdersBundle(),
    loadProductsBundle(),
    loadUsers(),
    loadVisits(),
    refreshList(),
  ];
  const results = await Promise.allSettled(tasks);
  const failed = results.find((r) => r.status === "rejected");
  if (failed) throw failed.reason;
}

function resetProductForm() {
  $("editProductId").value = "";
  $("productForm").reset();
  $("productSubmitBtn").textContent = "上传产品";
  $("productStatus").textContent = "";
  $("productStatus").className = "admin-status";
}

function fillProductForm(p) {
  $("editProductId").value = p.id;
  $("prodName").value = p.name || "";
  $("prodPrice").value = p.price || "";
  $("prodCategory").value = p.categoryId || "cat-mcu";
  $("prodTag").value = p.tag || "";
  $("prodImg").value = p.img || "";
  $("prodDesc").value = p.desc || "";
  $("prodIntro").value = p.intro || "";
  $("prodFeatures").value = (p.features || []).join("\n");
  $("prodPackage").value = (p.package || []).join("\n");
  $("productSubmitBtn").textContent = "保存修改";
  switchTab("products");
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
  } catch (err) {
    clearPass();
    alert("登录失败：" + err.message);
  }
});

$("logoutBtn").addEventListener("click", () => {
  clearPass();
  showPanel(false);
});

$("adminTabs").addEventListener("click", (e) => {
  const btn = e.target.closest(".admin-tab");
  if (!btn) return;
  switchTab(btn.dataset.tab);
});

$("refreshDashboard").addEventListener("click", () =>
  Promise.all([loadOrdersBundle(), loadVisits()]).catch((e) => alert(e.message))
);
$("refreshOrders").addEventListener("click", () => loadOrdersBundle().catch((e) => alert(e.message)));
$("refreshCustomers").addEventListener("click", () => loadOrdersBundle().catch((e) => alert(e.message)));
$("refreshProducts").addEventListener("click", () => loadProductsBundle().catch((e) => alert(e.message)));
$("refreshUsers").addEventListener("click", () => loadUsers().catch((e) => alert(e.message)));
$("refreshDocs").addEventListener("click", () => refreshList().catch((e) => alert(e.message)));

$("productResetBtn").addEventListener("click", resetProductForm);

$("productForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const status = $("productStatus");
  status.textContent = "保存中…";
  status.className = "admin-status";
  const editId = $("editProductId").value.trim();
  const payload = {
    action: editId ? "update" : "create",
    id: editId || undefined,
    name: $("prodName").value.trim(),
    price: $("prodPrice").value,
    categoryId: $("prodCategory").value,
    tag: $("prodTag").value.trim(),
    img: $("prodImg").value.trim(),
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

$("productsTable").addEventListener("click", async (e) => {
  const editBtn = e.target.closest("[data-edit-product]");
  if (editBtn) {
    const p = state.customProducts.find((x) => String(x.id) === String(editBtn.dataset.editProduct));
    if (p) fillProductForm(p);
    return;
  }
  const delBtn = e.target.closest("[data-del-product]");
  if (!delBtn) return;
  if (!confirm("确定删除该后台产品？")) return;
  try {
    await api("/api/admin/products", {
      method: "POST",
      body: JSON.stringify({ action: "delete", id: delBtn.dataset.delProduct }),
    });
    await loadProductsBundle();
  } catch (err) {
    alert(err.message);
  }
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
  if (!confirm("确定删除该资料登记？")) return;
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
  } catch {
    clearPass();
    showPanel(false);
  }
});
