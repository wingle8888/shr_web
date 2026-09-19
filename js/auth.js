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

  async function registerLocal({ name, email, password, phone }) {
    const users = localUsers();
    const key = email.toLowerCase();
    if (users.some((u) => u.email === key)) throw new Error("email already registered");
    const hash = await sha256(`shr:${key}:${password}`);
    const user = {
      id: `lu${Date.now()}`,
      email: key,
      name,
      phone: phone || "",
      hash,
      createdAt: new Date().toISOString(),
      source: "local",
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
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setSession({ token: data.token, user: data.user });
        rememberLocalProfile(data.user);
        return {
          ...data,
          needSync: Boolean(data.needSync || data.storage !== "blob"),
          syncCode: buildSyncCode([data.user]),
        };
      }
      if (res.status >= 400 && data.error) throw new Error(data.error);
      throw new Error("api unavailable");
    } catch (err) {
      const msg = String(err.message || "");
      if (msg.includes("already") || msg.includes("short") || msg.includes("invalid email") || msg.includes("required")) {
        throw err;
      }
      const local = await registerLocal(payload);
      return { ...local, syncCode: buildSyncCode([local.user]) };
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

  function mapAuthError(err) {
    const msg = String(err && err.message ? err.message : err || "");
    if (msg.includes("already")) return "authEmailTaken";
    if (msg.includes("short")) return "authPwdShort";
    if (msg.includes("invalid email")) return "authEmailInvalid";
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
    const switchToRegister = document.getElementById("switchToRegister");
    const switchToLogin = document.getElementById("switchToLogin");

    if (loginBtn) {
      loginBtn.addEventListener("click", () => {
        closeAuthModal("registerModal");
        openAuthModal("loginModal");
      });
    }
    if (registerBtn) {
      registerBtn.addEventListener("click", () => {
        closeAuthModal("loginModal");
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
        openAuthModal("registerModal");
      });
    }
    if (switchToLogin) {
      switchToLogin.addEventListener("click", () => {
        closeAuthModal("registerModal");
        openAuthModal("loginModal");
      });
    }

    ["loginClose", "registerClose"].forEach((id) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.addEventListener("click", () => {
        closeAuthModal(id === "loginClose" ? "loginModal" : "registerModal");
      });
    });

    ["loginModal", "registerModal"].forEach((id) => {
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
        const errEl = document.getElementById("registerError");
        if (errEl) errEl.hidden = true;
        try {
          const result = await register({ name, email, phone, password });
          closeAuthModal("registerModal");
          registerForm.reset();
          afterAuth();
          if (result && result.syncCode && result.needSync) {
            try {
              await navigator.clipboard.writeText(result.syncCode);
              if (toast) {
                toast(
                  (window.I18N && window.I18N.getLang() === "en")
                    ? "Registered. Sync code copied — paste it in Admin → Users."
                    : "注册成功。同步码已复制，请在电脑后台「注册资料」粘贴导入。"
                );
              } else {
                alert(
                  "注册成功！\n\n同步码已复制到剪贴板。\n请在电脑打开后台 → 注册资料 → 粘贴同步码导入。\n\n也可在手机打开后台点「同步本机注册」。"
                );
              }
            } catch (_) {
              prompt(
                "注册成功。请复制下面的同步码，到电脑后台「注册资料」粘贴导入：",
                result.syncCode
              );
            }
          } else {
            notify("authRegistered");
          }
        } catch (err) {
          const key = mapAuthError(err);
          if (errEl) {
            errEl.textContent = t(key);
            errEl.hidden = false;
          } else if (toast) toast(t(key));
        }
      });
    }

    const params = new URLSearchParams(location.search);
    const authParam = params.get("auth");
    if (authParam === "login") openAuthModal("loginModal");
    if (authParam === "register") openAuthModal("registerModal");
  }

  window.Auth = {
    getSession,
    currentUser,
    authHeader,
    register,
    login,
    logout,
    refreshAuthUI,
    prefillCheckoutFromUser,
    initAuthUI,
    buildSyncCode,
    parseSyncCode,
    localUsers,
  };
})();
