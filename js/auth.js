(function () {
  const SESSION_KEY = "shr_auth_session";
  const LOCAL_USERS_KEY = "shr_users_local";

  function getSession() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    } catch {
      return null;
    }
  }

  function setSession(session) {
    if (!session) localStorage.removeItem(SESSION_KEY);
    else localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  function currentUser() {
    const s = getSession();
    return s && s.user ? s.user : null;
  }

  function authHeader() {
    const s = getSession();
    return s && s.token ? { Authorization: `Bearer ${s.token}` } : {};
  }

  async function sha256(text) {
    const data = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  function localUsers() {
    try {
      return JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function saveLocalUsers(users) {
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
  }

  function normalizePhone(value) {
    return String(value || "").replace(/[\s\-()+]/g, "").trim();
  }

  function clientPlaceHint() {
    try {
      return {
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
        locale: navigator.language || "",
      };
    } catch {
      return { timezone: "", locale: "" };
    }
  }

  async function registerLocal({ name, email, password, phone }) {
    const users = localUsers();
    const key = email.toLowerCase();
    if (users.some((u) => u.email === key)) throw new Error("email already registered");
    const hash = await sha256(`shr:${key}:${password}`);
    const hint = clientPlaceHint();
    const user = {
      id: `lu${Date.now()}`,
      email: key,
      name,
      phone: phone || "",
      hash,
      createdAt: new Date().toISOString(),
      source: "local",
      registerPlace: hint.timezone ? { timezone: hint.timezone, label: hint.timezone } : null,
    };
    users.push(user);
    saveLocalUsers(users);
    const session = {
      token: `local.${user.id}`,
      user: { id: user.id, email: user.email, name: user.name, phone: user.phone },
    };
    setSession(session);
    return { ok: true, ...session, storage: "local", needSync: true, user: session.user };
  }

  function buildSyncCode(extraUsers) {
    const map = new Map();
    localUsers().forEach((u) => {
      if (u && u.email) map.set(String(u.email).toLowerCase(), u);
    });
    (extraUsers || []).forEach((u) => {
      if (u && u.email) map.set(String(u.email).toLowerCase(), u);
    });
    const users = Array.from(map.values()).map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      phone: u.phone || "",
      createdAt: u.createdAt,
      hash: u.hash || "",
      registerPlace: u.registerPlace || null,
      localHash: true,
      source: "sync-code",
    }));
    const payload = JSON.stringify({ v: 1, users });
    try {
      return btoa(unescape(encodeURIComponent(payload)));
    } catch {
      return btoa(payload);
    }
  }

  function parseSyncCode(code) {
    const raw = String(code || "").trim();
    if (!raw) throw new Error("empty sync code");
    let text;
    try {
      text = decodeURIComponent(escape(atob(raw)));
    } catch {
      text = atob(raw);
    }
    const data = JSON.parse(text);
    if (!data || !Array.isArray(data.users)) throw new Error("invalid sync code");
    return data.users;
  }

  function rememberLocalProfile(user, hash) {
    if (!user || !user.email) return;
    const users = localUsers();
    const key = String(user.email).toLowerCase();
    const idx = users.findIndex((u) => u.email === key);
    const row = {
      id: user.id,
      email: key,
      name: user.name,
      phone: user.phone || "",
      hash: hash || (idx >= 0 ? users[idx].hash : ""),
      createdAt: user.createdAt || new Date().toISOString(),
      source: user.source || "server",
      registerPlace: user.registerPlace || (idx >= 0 ? users[idx].registerPlace : null),
    };
    if (idx >= 0) users[idx] = { ...users[idx], ...row };
    else users.push(row);
    saveLocalUsers(users);
  }

  async function register(payload) {
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, ...clientPlaceHint() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setSession({ token: data.token, user: data.user });
        rememberLocalProfile(data.user);
        return {
          ...data,
          needSync: false,
          savedToServer: true,
        };
      }
      if (res.status === 503) {
        throw new Error(data.detail || data.error || "server storage unavailable");
      }
      if (res.status >= 400 && data.error) throw new Error(data.error);
      throw new Error("api unavailable");
    } catch (err) {
      const msg = String(err.message || "");
      if (
        msg.includes("already") ||
        msg.includes("short") ||
        msg.includes("mismatch") ||
        msg.includes("invalid email") ||
        msg.includes("required") ||
        msg.includes("storage") ||
        msg.includes("Blob") ||
        msg.includes("服务器")
      ) {
        throw err;
      }
      // 仅本地开发允许降级；线上必须走服务器
      const host = String(location.hostname || "");
      if (host.includes("vercel.app") || host.includes("shr-web") || host.includes("develop-boards.com") || host.includes("pages.dev")) {
        throw new Error("无法保存到服务器，请稍后重试或检查云存储配置");
      }
      const local = await registerLocal(payload);
      return { ...local, syncCode: buildSyncCode([local.user]), savedToServer: false };
    }
  }

  async function loginLocal({ email, password }) {
    const key = email.toLowerCase();
    const user = localUsers().find((u) => u.email === key);
    const hash = await sha256(`shr:${key}:${password}`);
    if (!user || user.hash !== hash) throw new Error("invalid credentials");
    const session = {
      token: `local.${user.id}`,
      user: { id: user.id, email: user.email, name: user.name, phone: user.phone || "" },
    };
    setSession(session);
    return session;
  }

  async function login(payload) {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setSession({ token: data.token, user: data.user });
        return data;
      }
      if (res.status === 401) throw new Error(data.error || "invalid credentials");
      if (res.status >= 400 && data.error) throw new Error(data.error);
      throw new Error("api unavailable");
    } catch (err) {
      if (String(err.message || "").includes("invalid")) throw err;
      return loginLocal(payload);
    }
  }

  function logout() {
    setSession(null);
  }

  async function resetLocal({ email, phone, password }) {
    const key = String(email || "").toLowerCase();
    const users = localUsers();
    const idx = users.findIndex((u) => u.email === key);
    if (idx < 0) throw new Error("phone mismatch");
    const storedPhone = normalizePhone(users[idx].phone);
    if (!storedPhone) throw new Error("no phone");
    if (storedPhone !== normalizePhone(phone)) throw new Error("phone mismatch");
    users[idx] = { ...users[idx], hash: await sha256(`shr:${key}:${password}`) };
    saveLocalUsers(users);
    return { ok: true, reset: true, storage: "local" };
  }

  async function resetPassword(payload) {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, action: "reset" }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) return data;
      if (res.status >= 400 && data.error) throw new Error(data.error);
      throw new Error("api unavailable");
    } catch (err) {
      const msg = String(err.message || "");
      if (
        msg.includes("mismatch") ||
        msg.includes("short") ||
        msg.includes("required") ||
        msg.includes("no phone") ||
        msg.includes("storage")
      ) {
        throw err;
      }
      const host = String(location.hostname || "");
      if (host.includes("vercel.app") || host.includes("shr-web") || host.includes("develop-boards.com") || host.includes("pages.dev")) throw err;
      return resetLocal(payload);
    }
  }

  function mapAuthError(err) {
    const msg = String(err && err.message ? err.message : err || "");
    if (msg.includes("already")) return "authEmailTaken";
    if (msg.includes("mismatch") && msg.includes("password")) return "authPwdMismatch";
    if (msg.includes("short")) return "authPwdShort";
    if (msg.includes("invalid email")) return "authEmailInvalid";
    if (msg.includes("no phone")) return "authNoPhone";
    if (msg.includes("phone mismatch")) return "authPhoneMismatch";
    if (msg.includes("phone required")) return "authPhoneRequired";
    if (msg.includes("invalid")) return "authBadCreds";
    if (msg.includes("required")) return "authRequired";
    return "authFailed";
  }

  function refreshAuthUI() {
    const user = currentUser();
    const loginBtn = document.getElementById("loginBtn");
    const registerBtn = document.getElementById("registerBtn");
    const logoutBtn = document.getElementById("logoutBtn");
    const authUser = document.getElementById("authUser");
    if (!loginBtn && !authUser) return;
    if (user) {
      if (loginBtn) loginBtn.hidden = true;
      if (registerBtn) registerBtn.hidden = true;
      if (logoutBtn) logoutBtn.hidden = false;
      if (authUser) {
        authUser.hidden = false;
        authUser.textContent = user.name || user.email;
        authUser.title = user.email || "";
      }
    } else {
      if (loginBtn) loginBtn.hidden = false;
      if (registerBtn) registerBtn.hidden = false;
      if (logoutBtn) logoutBtn.hidden = true;
      if (authUser) {
        authUser.hidden = true;
        authUser.textContent = "";
      }
    }
  }

  function openAuthModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add("show");
  }

  function closeAuthModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove("show");
  }

  function prefillCheckoutFromUser() {
    const user = currentUser();
    if (!user) return;
    const name = document.getElementById("shipName");
    const phone = document.getElementById("shipPhone");
    const email = document.getElementById("shipEmail");
    if (name && !name.value && user.name) name.value = user.name;
    if (phone && !phone.value && user.phone) phone.value = user.phone;
    if (email && !email.value && user.email) email.value = user.email;
  }

  function initAuthUI(opts) {
    const onChange = opts && typeof opts.onChange === "function" ? opts.onChange : null;
    const toast = opts && typeof opts.toast === "function" ? opts.toast : null;
    const t = opts && typeof opts.t === "function" ? opts.t : (k) => k;

    function notify(key) {
      if (toast) toast(t(key));
    }

    function afterAuth() {
      refreshAuthUI();
      prefillCheckoutFromUser();
      if (onChange) onChange(currentUser());
    }

    refreshAuthUI();

    const loginBtn = document.getElementById("loginBtn");
    const registerBtn = document.getElementById("registerBtn");
    const logoutBtn = document.getElementById("logoutBtn");
    const loginForm = document.getElementById("loginForm");
    const registerForm = document.getElementById("registerForm");
    const forgotForm = document.getElementById("forgotForm");
    const switchToRegister = document.getElementById("switchToRegister");
    const switchToLogin = document.getElementById("switchToLogin");
    const forgotPasswordBtn = document.getElementById("forgotPasswordBtn");
    const switchForgotToLogin = document.getElementById("switchForgotToLogin");

    if (loginBtn) {
      loginBtn.addEventListener("click", () => {
        closeAuthModal("registerModal");
        closeAuthModal("forgotModal");
        openAuthModal("loginModal");
      });
    }
    if (registerBtn) {
      registerBtn.addEventListener("click", () => {
        closeAuthModal("loginModal");
        closeAuthModal("forgotModal");
        openAuthModal("registerModal");
      });
    }
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        logout();
        afterAuth();
        notify("authLoggedOut");
      });
    }
    if (switchToRegister) {
      switchToRegister.addEventListener("click", () => {
        closeAuthModal("loginModal");
        closeAuthModal("forgotModal");
        openAuthModal("registerModal");
      });
    }
    if (switchToLogin) {
      switchToLogin.addEventListener("click", () => {
        closeAuthModal("registerModal");
        closeAuthModal("forgotModal");
        openAuthModal("loginModal");
      });
    }
    if (forgotPasswordBtn) {
      forgotPasswordBtn.addEventListener("click", () => {
        const email = document.getElementById("loginEmail");
        const forgotEmail = document.getElementById("forgotEmail");
        if (email && forgotEmail && email.value) forgotEmail.value = email.value;
        closeAuthModal("loginModal");
        closeAuthModal("registerModal");
        openAuthModal("forgotModal");
      });
    }
    if (switchForgotToLogin) {
      switchForgotToLogin.addEventListener("click", () => {
        closeAuthModal("forgotModal");
        openAuthModal("loginModal");
      });
    }

    ["loginClose", "registerClose", "forgotClose"].forEach((id) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.addEventListener("click", () => {
        closeAuthModal(id.replace("Close", "Modal"));
      });
    });

    ["loginModal", "registerModal", "forgotModal"].forEach((id) => {
      const overlay = document.getElementById(id);
      if (!overlay) return;
      overlay.addEventListener("click", (e) => {
        if (e.target.id === id) closeAuthModal(id);
      });
    });

    if (loginForm) {
      loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("loginEmail").value.trim();
        const password = document.getElementById("loginPassword").value;
        const errEl = document.getElementById("loginError");
        if (errEl) errEl.hidden = true;
        try {
          await login({ email, password });
          closeAuthModal("loginModal");
          loginForm.reset();
          afterAuth();
          notify("authLoggedIn");
        } catch (err) {
          const key = mapAuthError(err);
          if (errEl) {
            errEl.textContent = t(key);
            errEl.hidden = false;
          } else if (toast) toast(t(key));
        }
      });
    }

    if (registerForm) {
      registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = document.getElementById("regName").value.trim();
        const email = document.getElementById("regEmail").value.trim();
        const phone = document.getElementById("regPhone").value.trim();
        const password = document.getElementById("regPassword").value;
        const passwordConfirm = document.getElementById("regPasswordConfirm")
          ? document.getElementById("regPasswordConfirm").value
          : password;
        const errEl = document.getElementById("registerError");
        if (errEl) errEl.hidden = true;
        try {
          if (!phone) throw new Error("phone required");
          if (password !== passwordConfirm) throw new Error("password mismatch");
          const result = await register({ name, email, phone, password, passwordConfirm });
          closeAuthModal("registerModal");
          registerForm.reset();
          afterAuth();
          if (result && result.savedToServer) {
            if (toast) toast(t("authRegisteredServer") !== "authRegisteredServer" ? t("authRegisteredServer") : "注册成功，资料已保存到服务器，后台可直接查看");
            else notify("authRegistered");
          } else if (result && result.syncCode) {
            try {
              await navigator.clipboard.writeText(result.syncCode);
              if (toast) toast("本地注册成功，同步码已复制（仅开发环境）");
            } catch (_) {
              prompt("请复制同步码：", result.syncCode);
            }
          } else {
            notify("authRegistered");
          }
        } catch (err) {
          const msg = String(err.message || "");
          if (errEl) {
            if (/not configured|未检测|未配置|BLOB_MISSING/i.test(msg)) {
              errEl.textContent = "服务器未配置云存储，无法保存注册资料。请管理员确认 Cloudflare R2 已绑定并重新部署。";
            } else if (/write failed|写入|BLOB_WRITE/i.test(msg)) {
              errEl.textContent = "云存储写入失败：" + msg;
            } else {
              errEl.textContent = t(mapAuthError(err));
            }
            errEl.hidden = false;
          } else if (toast) toast(t(mapAuthError(err)));
        }
      });
    }

    if (forgotForm) {
      forgotForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("forgotEmail").value.trim();
        const phone = document.getElementById("forgotPhone").value.trim();
        const password = document.getElementById("forgotPassword").value;
        const passwordConfirm = document.getElementById("forgotPasswordConfirm").value;
        const errEl = document.getElementById("forgotError");
        if (errEl) errEl.hidden = true;
        try {
          if (password !== passwordConfirm) throw new Error("password mismatch");
          await resetPassword({ email, phone, password, passwordConfirm });
          closeAuthModal("forgotModal");
          forgotForm.reset();
          openAuthModal("loginModal");
          notify("authResetOk");
        } catch (err) {
          if (errEl) {
            errEl.textContent = t(mapAuthError(err));
            errEl.hidden = false;
          } else if (toast) toast(t(mapAuthError(err)));
        }
      });
    }

    const params = new URLSearchParams(location.search);
    const authParam = params.get("auth");
    if (authParam === "login") openAuthModal("loginModal");
    if (authParam === "register") openAuthModal("registerModal");
    if (authParam === "forgot") openAuthModal("forgotModal");
  }

  window.Auth = {
    getSession,
    currentUser,
    authHeader,
    register,
    login,
    resetPassword,
    logout,
    refreshAuthUI,
    prefillCheckoutFromUser,
    initAuthUI,
    buildSyncCode,
    parseSyncCode,
    localUsers,
  };
})();
