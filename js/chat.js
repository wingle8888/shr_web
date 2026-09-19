(function () {
  const CHAT_STORAGE_KEY = "shr_chat_messages";
  const GEOM_KEY = "shr_chat_geom";
  const WIN_NAME = "shrSupportChat";
  const MIN_W = 280;
  const MIN_H = 220;

  let lastSellerOnline = false;
  let customerChatTimer = null;
  let unreadTimer = null;
  let popup = null;
  let dragState = null;
  let maximized = false;
  let savedGeom = null;

  function isChatPage() {
    return document.body && document.body.classList.contains("chat-page");
  }

  function t(key, vars) {
    return window.I18N && window.I18N.t ? window.I18N.t(key, vars) : key;
  }

  function chatText(key, fallback) {
    const text = t(key);
    return !text || text === key ? fallback : text;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatChatTime(date = new Date()) {
    const locale = window.I18N && window.I18N.getLang() === "en" ? "en-US" : "zh-CN";
    return date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  }

  function chatVisitorId() {
    try {
      let id = localStorage.getItem("shr_visitor_id");
      if (!id) {
        id = "v" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
        localStorage.setItem("shr_visitor_id", id);
      }
      return id;
    } catch {
      return "anon";
    }
  }

  function loadChatHistory() {
    try {
      return JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function saveChatHistory(messages) {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages.slice(-40)));
  }

  function panel() {
    return document.getElementById("chatPanel");
  }

  function miniBar() {
    return document.getElementById("chatMiniBar");
  }

  function isMinimized() {
    const bar = miniBar();
    return Boolean(bar && !bar.hidden);
  }

  function chatSessionOpen() {
    if (isChatPage()) return !document.hidden;
    if (popup && !popup.closed) return true;
    const el = panel();
    if (el && !el.hidden) return true;
    return isMinimized();
  }

  function chatPanelOpen() {
    if (document.hidden) return false;
    return chatSessionOpen();
  }

  function appendChatBubble(role, text, time) {
    const box = document.getElementById("chatMessages");
    if (!box) return;
    const el = document.createElement("div");
    el.className = `chat-bubble ${role === "admin" ? "admin" : role}`;
    const label =
      role === "admin"
        ? `<div class="chat-bubble-label">${escapeHtml(
            lastSellerOnline ? chatText("chatSellerOnline", "卖家 · 在线") : chatText("chatSellerOffline", "卖家 · 离线")
          )}</div>`
        : "";
    el.innerHTML = `${label}${escapeHtml(text)}<div class="chat-time">${time || formatChatTime()}</div>`;
    box.appendChild(el);
    box.scrollTop = box.scrollHeight;
  }

  function messageTime(item) {
    if (item.time) return item.time;
    if (item.createdAt) {
      try {
        return formatChatTime(new Date(item.createdAt));
      } catch (_) {}
    }
    return formatChatTime();
  }

  function renderChatMessages(messages) {
    const box = document.getElementById("chatMessages");
    if (!box) return;
    box.innerHTML = "";
    messages.forEach((m) => appendChatBubble(m.role, m.text, messageTime(m)));
  }

  function pushMessage(role, text) {
    const messages = loadChatHistory();
    const item = { role, text, time: formatChatTime() };
    messages.push(item);
    saveChatHistory(messages);
    appendChatBubble(role, text, item.time);
  }

  function chatIdentity() {
    const user = window.Auth && window.Auth.currentUser ? window.Auth.currentUser() : null;
    return {
      visitorId: chatVisitorId(),
      member: Boolean(user && (user.id || user.email)),
      userId: user && user.id ? String(user.id) : "",
      name: user && user.name ? String(user.name) : "",
      email: user && user.email ? String(user.email) : "",
    };
  }

  function updateSellerPresence(online) {
    lastSellerOnline = Boolean(online);
    const status = document.getElementById("chatAgentStatus");
    const dot = document.getElementById("chatSellerDot");
    if (status) {
      status.textContent = lastSellerOnline ? chatText("chatOnline", "在线") : chatText("chatOffline", "离线");
      status.classList.toggle("is-online", lastSellerOnline);
    }
    if (dot) dot.classList.toggle("is-online", lastSellerOnline);
    const miniDot = document.getElementById("chatMiniDot");
    if (miniDot) miniDot.classList.toggle("is-online", lastSellerOnline);
  }

  function setUnread(show) {
    const unread = document.getElementById("chatUnread");
    if (!unread) return;
    unread.style.display = show && !chatSessionOpen() ? "inline-flex" : "none";
  }

  async function fetchChatThread(opts) {
    const { visitorId } = chatIdentity();
    const presence = opts && opts.peek ? "0" : chatPanelOpen() ? "1" : "0";
    const peek = opts && opts.peek ? "&peek=1" : "";
    const res = await fetch(
      "/api/chat?visitorId=" + encodeURIComponent(visitorId) + "&presence=" + presence + peek,
      { cache: "no-store" }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) return null;
    if (!(opts && opts.peek)) updateSellerPresence(data.sellerOnline);
    return data;
  }

  function applyServerMessages(conversation) {
    const messages = ((conversation && conversation.messages) || []).map((m) => ({
      role: m.role,
      text: m.text,
      time: messageTime(m),
      createdAt: m.createdAt,
    }));
    if (!messages.length) return false;
    saveChatHistory(messages);
    renderChatMessages(messages);
    return true;
  }

  async function syncChatFromServer() {
    try {
      const data = await fetchChatThread();
      if (data && applyServerMessages(data.conversation)) return true;
    } catch (_) {}
    return false;
  }

  function renderChatHistory() {
    const messages = loadChatHistory();
    const box = document.getElementById("chatMessages");
    if (!box) return;
    if (messages.length === 0) {
      box.innerHTML = "";
      pushMessage("bot", t("welcome"));
      return;
    }
    renderChatMessages(messages);
  }

  async function sendChatToServer(text) {
    const ident = chatIdentity();
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        visitorId: ident.visitorId,
        text,
        name: ident.name,
        email: ident.email,
        member: ident.member,
        userId: ident.userId,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error || "send failed");
    updateSellerPresence(data.sellerOnline);
    applyServerMessages(data.conversation);
  }

  function handleChatSend(text) {
    const msg = String(text || "").trim();
    if (!msg) return;
    pushMessage("user", msg);
    sendChatToServer(msg).catch(() => {});
  }

  function startCustomerChatPoll() {
    if (customerChatTimer) return;
    customerChatTimer = setInterval(() => {
      if (!chatPanelOpen()) return;
      syncChatFromServer().catch(() => {});
    }, 4000);
  }

  function stopCustomerChatPoll() {
    if (!customerChatTimer) return;
    clearInterval(customerChatTimer);
    customerChatTimer = null;
  }

  function defaultGeom() {
    const w = Math.min(400, Math.max(MIN_W, window.innerWidth - 24));
    const h = Math.min(560, Math.max(MIN_H, window.innerHeight - 24));
    return {
      x: Math.max(8, window.innerWidth - w - 16),
      y: Math.max(8, Math.min(88, window.innerHeight - h - 16)),
      w,
      h,
    };
  }

  function readGeom() {
    try {
      const raw = JSON.parse(localStorage.getItem(GEOM_KEY) || "null");
      if (raw && Number(raw.w) >= MIN_W && Number(raw.h) >= MIN_H) {
        return {
          x: Math.min(Math.max(0, Number(raw.x) || 0), Math.max(0, window.innerWidth - 80)),
          y: Math.min(Math.max(0, Number(raw.y) || 0), Math.max(0, window.innerHeight - 48)),
          w: Math.min(Number(raw.w), window.innerWidth - 8),
          h: Math.min(Number(raw.h), window.innerHeight - 8),
        };
      }
    } catch (_) {}
    return defaultGeom();
  }

  function writeGeom(g) {
    try {
      localStorage.setItem(GEOM_KEY, JSON.stringify(g));
    } catch (_) {}
  }

  function applyGeom(g) {
    const el = panel();
    if (!el || isChatPage()) return;
    el.style.left = g.x + "px";
    el.style.top = g.y + "px";
    el.style.width = g.w + "px";
    el.style.height = g.h + "px";
    el.style.right = "auto";
    el.style.bottom = "auto";
  }

  function currentGeom() {
    const el = panel();
    if (!el) return defaultGeom();
    return {
      x: el.offsetLeft,
      y: el.offsetTop,
      w: el.offsetWidth,
      h: el.offsetHeight,
    };
  }

  function clampGeom(g) {
    const w = Math.min(Math.max(MIN_W, g.w), window.innerWidth - 8);
    const h = Math.min(Math.max(MIN_H, g.h), window.innerHeight - 8);
    return {
      w,
      h,
      x: Math.min(Math.max(0, g.x), Math.max(0, window.innerWidth - 48)),
      y: Math.min(Math.max(0, g.y), Math.max(0, window.innerHeight - 48)),
    };
  }

  function updateMaxButton() {
    const btn = document.getElementById("chatMax");
    if (!btn) return;
    btn.textContent = maximized ? "❐" : "□";
    btn.setAttribute("aria-label", maximized ? chatText("chatRestore", "还原") : chatText("chatMax", "最大化"));
    btn.title = btn.getAttribute("aria-label");
  }

  function setMaximized(on) {
    const el = panel();
    if (!el || isChatPage()) return;
    if (on) {
      if (!maximized) savedGeom = currentGeom();
      maximized = true;
      el.classList.add("is-max");
      applyGeom({ x: 8, y: 8, w: window.innerWidth - 16, h: window.innerHeight - 16 });
    } else {
      maximized = false;
      el.classList.remove("is-max");
      applyGeom(clampGeom(savedGeom || readGeom() || defaultGeom()));
    }
    updateMaxButton();
  }

  function minimizeChat() {
    const el = panel();
    const bar = miniBar();
    if (isChatPage()) {
      if (window.blur) window.blur();
      return;
    }
    if (el) el.hidden = true;
    if (bar) bar.hidden = false;
    startCustomerChatPoll();
  }

  function restoreFromMini() {
    const el = panel();
    const bar = miniBar();
    if (bar) bar.hidden = true;
    if (el) {
      el.hidden = false;
      if (!maximized) applyGeom(readGeom());
      else setMaximized(true);
    }
    setUnread(false);
    startCustomerChatPoll();
    const input = document.getElementById("chatInput");
    if (input) input.focus();
    const box = document.getElementById("chatMessages");
    if (box) box.scrollTop = box.scrollHeight;
    syncChatFromServer().catch(() => {});
  }

  function closeInlineChat() {
    const el = panel();
    const bar = miniBar();
    if (el) el.hidden = true;
    if (bar) bar.hidden = true;
    maximized = false;
    if (el) el.classList.remove("is-max");
    if (!isChatPage()) stopCustomerChatPoll();
  }

  function openInlineChat() {
    const el = panel();
    if (!el) return;
    if (el.hidden) applyGeom(readGeom());
    el.hidden = false;
    const bar = miniBar();
    if (bar) bar.hidden = true;
    setUnread(false);
    const input = document.getElementById("chatInput");
    if (input) input.focus();
    const box = document.getElementById("chatMessages");
    if (box) box.scrollTop = box.scrollHeight;
    syncChatFromServer().catch(() => {});
    startCustomerChatPoll();
  }

  function popupFeatures() {
    const w = Math.min(420, Math.max(360, window.screen.availWidth ? Math.min(420, window.screen.availWidth) : 420));
    const h = Math.min(640, window.screen.availHeight ? Math.min(640, window.screen.availHeight - 40) : 640);
    const dualLeft = window.screenLeft || window.screenX || 0;
    const dualTop = window.screenTop || window.screenY || 0;
    const left = Math.max(0, dualLeft + Math.max(0, (window.outerWidth || w) - w - 24));
    const top = Math.max(0, dualTop + 72);
    return `popup=yes,width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes,menubar=no,toolbar=no,location=no,status=no`;
  }

  function openPopupWindow() {
    if (popup && !popup.closed) {
      popup.focus();
      return popup;
    }
    try {
      popup = window.open("/chat.html", WIN_NAME, popupFeatures());
    } catch (_) {
      popup = null;
    }
    if (!popup) return null;
    setUnread(false);
    closeInlineChat();
    return popup;
  }

  function openSupportChat() {
    if (isChatPage()) return;
    const win = openPopupWindow();
    if (win) return;
    openInlineChat();
  }

  function onHeaderPointerDown(e) {
    if (isChatPage() || maximized) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (e.target.closest("button")) return;
    const el = panel();
    if (!el) return;
    const g = currentGeom();
    dragState = { type: "move", x: e.clientX, y: e.clientY, gx: g.x, gy: g.y, gw: g.w, gh: g.h };
    el.classList.add("is-dragging");
    e.preventDefault();
  }

  function onResizePointerDown(e) {
    if (isChatPage() || maximized) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const handle = e.target.closest("[data-resize]");
    if (!handle) return;
    const el = panel();
    if (!el) return;
    const g = currentGeom();
    dragState = {
      type: handle.dataset.resize,
      x: e.clientX,
      y: e.clientY,
      gx: g.x,
      gy: g.y,
      gw: g.w,
      gh: g.h,
    };
    el.classList.add("is-dragging");
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!dragState) return;
    const dx = e.clientX - dragState.x;
    const dy = e.clientY - dragState.y;
    let next = { x: dragState.gx, y: dragState.gy, w: dragState.gw, h: dragState.gh };
    if (dragState.type === "move") {
      next.x = dragState.gx + dx;
      next.y = dragState.gy + dy;
    } else {
      const dir = dragState.type;
      if (dir.indexOf("e") >= 0) next.w = dragState.gw + dx;
      if (dir.indexOf("s") >= 0) next.h = dragState.gh + dy;
      if (dir.indexOf("w") >= 0) {
        next.w = dragState.gw - dx;
        next.x = dragState.gx + dx;
      }
      if (dir.indexOf("n") >= 0) {
        next.h = dragState.gh - dy;
        next.y = dragState.gy + dy;
      }
    }
    applyGeom(clampGeom(next));
  }

  function onPointerUp() {
    if (!dragState) return;
    dragState = null;
    const el = panel();
    if (el) el.classList.remove("is-dragging");
    if (!maximized) writeGeom(currentGeom());
  }

  function bindWindowChrome() {
    const header = document.getElementById("chatHeader");
    if (header) header.addEventListener("pointerdown", onHeaderPointerDown);
    document.querySelectorAll("#chatPanel [data-resize]").forEach((handle) => {
      handle.addEventListener("pointerdown", onResizePointerDown);
    });
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("resize", () => {
      if (isChatPage()) return;
      const el = panel();
      if (!el || el.hidden) return;
      if (maximized) setMaximized(true);
      else applyGeom(clampGeom(currentGeom()));
    });
    const minBtn = document.getElementById("chatMin");
    const maxBtn = document.getElementById("chatMax");
    const closeBtn = document.getElementById("chatClose");
    const bar = miniBar();
    if (minBtn) minBtn.addEventListener("click", minimizeChat);
    if (maxBtn) maxBtn.addEventListener("click", () => setMaximized(!maximized));
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        if (isChatPage()) {
          window.close();
          return;
        }
        closeInlineChat();
      });
    }
    if (bar) bar.addEventListener("click", restoreFromMini);
    updateMaxButton();
  }

  function bindChatForm() {
    const form = document.getElementById("chatForm");
    const input = document.getElementById("chatInput");
    const quick = document.getElementById("chatQuick");
    if (form && input) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        handleChatSend(input.value);
        input.value = "";
      });
    }
    if (quick) {
      quick.addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-q]");
        if (!btn) return;
        if (btn.dataset.q === "order") {
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage({ type: "shr-open-lookup" }, location.origin);
            window.opener.focus();
            return;
          }
          if (typeof window.openLookup === "function") {
            window.openLookup();
            return;
          }
          location.href = "/";
          return;
        }
        handleChatSend(btn.dataset.q);
      });
    }
  }

  async function pollUnread() {
    if (isChatPage() || chatSessionOpen()) {
      setUnread(false);
      return;
    }
    try {
      const data = await fetchChatThread({ peek: true });
      const n = Number(data && data.unreadCustomer) || 0;
      setUnread(n > 0);
    } catch (_) {}
  }

  function startUnreadPoll() {
    if (isChatPage() || unreadTimer) return;
    unreadTimer = setInterval(pollUnread, 8000);
  }

  function onLangChange() {
    updateSellerPresence(lastSellerOnline);
    const messages = loadChatHistory();
    if (messages.length <= 1) {
      localStorage.removeItem(CHAT_STORAGE_KEY);
      renderChatHistory();
      return;
    }
    renderChatMessages(messages);
    updateMaxButton();
  }

  function initChatPage() {
    if (window.I18N && window.I18N.applyI18n) window.I18N.applyI18n();
    renderChatHistory();
    updateSellerPresence(false);
    bindChatForm();
    bindWindowChrome();
    startCustomerChatPoll();
    syncChatFromServer().catch(() => {});
    document.addEventListener("visibilitychange", () => {
      if (chatPanelOpen()) syncChatFromServer().catch(() => {});
    });
    const input = document.getElementById("chatInput");
    if (input) input.focus();
  }

  function initMallLauncher() {
    const launcher = document.getElementById("chatLauncher");
    if (!launcher) return;
    renderChatHistory();
    updateSellerPresence(false);
    bindChatForm();
    bindWindowChrome();
    applyGeom(readGeom());
    const el = panel();
    if (el) el.hidden = true;
    const bar = miniBar();
    if (bar) bar.hidden = true;
    startUnreadPoll();
    pollUnread();
    launcher.addEventListener("click", openSupportChat);
    document.addEventListener("visibilitychange", () => {
      if (chatPanelOpen()) syncChatFromServer().catch(() => {});
      else pollUnread();
    });
    window.addEventListener("focus", () => {
      if (popup && popup.closed) popup = null;
    });
  }

  function init() {
    if (isChatPage()) initChatPage();
    else initMallLauncher();
  }

  window.SHRChat = {
    init,
    open: openSupportChat,
    onLangChange,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
