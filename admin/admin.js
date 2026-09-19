const PASS_KEY = "shr_admin_pass";

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

function productOptions() {
  const sel = $("productId");
  const products = window.PRODUCTS || [];
  sel.innerHTML = products
    .map((p) => `<option value="${p.id}">#${p.id} ${p.name}</option>`)
    .join("");
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

function showPanel(loggedIn) {
  $("loginCard").hidden = loggedIn;
  $("panelCard").hidden = !loggedIn;
}

function formatSize(n) {
  if (!n && n !== 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

async function refreshList() {
  const box = $("fileList");
  box.textContent = "加载中…";
  try {
    const data = await api("/api/admin/files");
    const manifest = data.downloads || {};
    const products = window.PRODUCTS || [];
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
              <button type="button" class="danger" data-del-product="${id}" data-del-id="${escapeHtml(f.id)}">删除</button>
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

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
    productOptions();
    await refreshList();
  } catch (err) {
    clearPass();
    alert("登录失败：" + err.message);
  }
});

$("logoutBtn").addEventListener("click", () => {
  clearPass();
  showPanel(false);
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
        productId: btn.dataset.delProduct,
        fileId: btn.dataset.delId,
      }),
    });
    await refreshList();
  } catch (err) {
    alert(err.message);
  }
});

document.addEventListener("DOMContentLoaded", async () => {
  productOptions();
  if (!getPass()) {
    showPanel(false);
    return;
  }
  try {
    await api("/api/admin/files");
    showPanel(true);
    await refreshList();
  } catch {
    clearPass();
    showPanel(false);
  }
});
