const path = require("path");
const { readJsonStore, writeJsonStore } = require("./blob-store");
const { readUsers } = require("./auth-store");

const DATA_FILE = path.join(process.cwd(), "data", "chats.json");
const TMP_FILE = path.join("/tmp", "shr-chats.json");
const BLOB_PATH = "shr-admin/chats-db.json";
const MAX_THREADS = 80;
const MAX_MESSAGES = 80;

const DEFAULT_AUTO_REPLY =
  "您好，已收到您的留言，卖家看到后会尽快回复。";

function normalizeAutoReply(raw) {
  const message = String((raw && raw.message) || "").trim().slice(0, 500);
  return {
    enabled: Boolean(raw && raw.enabled),
    message: message || DEFAULT_AUTO_REPLY,
  };
}

function unwrap(raw) {
  const threads = Array.isArray(raw)
    ? raw
    : raw && Array.isArray(raw.threads)
      ? raw.threads
      : [];
  return {
    threads,
    autoReply: normalizeAutoReply(raw && !Array.isArray(raw) ? raw.autoReply : null),
  };
}

function mergeThreads(a, b) {
  const left = unwrap(a);
  const right = unwrap(b);
  const map = new Map();
  [...left.threads, ...right.threads].forEach((t) => {
    if (!t || !t.visitorId) return;
    const key = String(t.visitorId);
    const prev = map.get(key);
    if (!prev) {
      map.set(key, t);
      return;
    }
    const prevT = String(prev.updatedAt || "");
    const nextT = String(t.updatedAt || "");
    map.set(key, nextT >= prevT ? t : prev);
  });
  const autoReply =
    b && typeof b === "object" && !Array.isArray(b) && b.autoReply
      ? right.autoReply
      : left.autoReply;
  return {
    threads: Array.from(map.values())
      .sort((x, y) => String(y.updatedAt || "").localeCompare(String(x.updatedAt || "")))
      .slice(0, MAX_THREADS),
    autoReply,
  };
}

async function readChats() {
  const raw = await readJsonStore({
    blobPath: BLOB_PATH,
    localPaths: [TMP_FILE, DATA_FILE],
    empty: { threads: [], autoReply: normalizeAutoReply({ enabled: false, message: DEFAULT_AUTO_REPLY }) },
    merge: mergeThreads,
  });
  return unwrap(raw);
}

async function writeChats(data) {
  const next = mergeThreads({ threads: [] }, data);
  await writeJsonStore({
    blobPath: BLOB_PATH,
    localPaths: [TMP_FILE, DATA_FILE],
    data: next,
  });
  return next;
}

function makeMessage(role, text) {
  return {
    id: "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    role: role === "admin" || role === "bot" ? role : "user",
    text: String(text || "").trim().slice(0, 500),
    createdAt: new Date().toISOString(),
  };
}

function preview(text) {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  return s.length > 48 ? s.slice(0, 48) + "…" : s;
}

function guestLabel(visitorId) {
  const raw = String(visitorId || "").trim();
  const id = raw.replace(/^v/i, "") || raw || "0";
  return "游客" + id;
}

function displayTitle(thread) {
  const isMember = Boolean(
    thread && (thread.member || thread.userId || String(thread.name || "").trim() || String(thread.email || "").trim())
  );
  if (isMember) {
    const name = String(thread.name || "").trim();
    if (name) return name;
    const email = String(thread.email || "").trim();
    if (email) return email.split("@")[0];
    return "会员" + guestLabel(thread.visitorId).replace(/^游客/, "");
  }
  return guestLabel(thread && thread.visitorId);
}

function summarize(thread) {
  const msgs = Array.isArray(thread.messages) ? thread.messages : [];
  const last = msgs[msgs.length - 1];
  return {
    id: thread.id,
    visitorId: thread.visitorId,
    member: Boolean(thread.member),
    name: thread.name || "",
    email: thread.email || "",
    displayName: displayTitle(thread),
    updatedAt: thread.updatedAt,
    lastMessage: thread.lastMessage || (last ? preview(last.text) : ""),
    lastRole: last ? last.role : "",
    unreadAdmin: Number(thread.unreadAdmin) || 0,
    unreadCustomer: Number(thread.unreadCustomer) || 0,
    messageCount: msgs.length,
  };
}

async function getThread(visitorId) {
  const vid = String(visitorId || "").trim().slice(0, 64);
  if (!vid) return null;
  const db = await readChats();
  return db.threads.find((t) => String(t.visitorId) === vid) || null;
}

async function resolveMember({ name, email, member, userId }) {
  const incomingName = String(name || "").trim().slice(0, 80);
  const incomingEmail = String(email || "").trim().toLowerCase();
  const incomingId = String(userId || "").trim();
  try {
    const users = await readUsers();
    const found = (users || []).find((u) => {
      if (!u) return false;
      if (incomingId && String(u.id) === incomingId) return true;
      if (incomingEmail && String(u.email || "").trim().toLowerCase() === incomingEmail) return true;
      return false;
    });
    if (found) {
      return {
        member: true,
        name: String(found.name || incomingName || "").trim().slice(0, 80),
        email: String(found.email || incomingEmail || "").trim().slice(0, 120),
        userId: String(found.id || incomingId || ""),
      };
    }
  } catch (_) {}
  if (member) {
    return {
      member: true,
      name: incomingName,
      email: incomingEmail,
      userId: incomingId,
    };
  }
  return { member: false, name: "", email: incomingEmail, userId: incomingId };
}

async function appendMessage({ visitorId, role, text, name, email, mark, member, userId }) {
  const vid = String(visitorId || "").trim().slice(0, 64);
  const msg = makeMessage(role, text);
  if (!vid || !msg.text) throw new Error("visitorId and text required");
  const db = await readChats();
  let thread = db.threads.find((t) => String(t.visitorId) === vid);
  if (!thread) {
    thread = {
      id: "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      visitorId: vid,
      member: false,
      userId: "",
      name: "",
      email: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      unreadAdmin: 0,
      unreadCustomer: 0,
      messages: [],
    };
    db.threads.unshift(thread);
  }
  if (role === "user") {
    const ident = await resolveMember({ name, email, member, userId });
    if (ident.member) {
      thread.member = true;
      if (ident.name) thread.name = ident.name;
      if (ident.email) thread.email = ident.email;
      if (ident.userId) thread.userId = ident.userId;
    } else if (!thread.member) {
      thread.member = false;
      thread.name = "";
      thread.email = "";
      thread.userId = "";
    }
  }
  thread.messages = Array.isArray(thread.messages) ? thread.messages : [];
  thread.messages.push(msg);
  if (thread.messages.length > MAX_MESSAGES) thread.messages = thread.messages.slice(-MAX_MESSAGES);
  thread.updatedAt = msg.createdAt;
  thread.lastMessage = preview(msg.text);
  if (mark === "admin") thread.unreadAdmin = (Number(thread.unreadAdmin) || 0) + 1;
  if (mark === "customer") thread.unreadCustomer = (Number(thread.unreadCustomer) || 0) + 1;
  if (role === "user") {
    const auto = db.autoReply || normalizeAutoReply(null);
    if (auto.enabled && auto.message) {
      const bot = makeMessage("bot", auto.message);
      thread.messages.push(bot);
      if (thread.messages.length > MAX_MESSAGES) thread.messages = thread.messages.slice(-MAX_MESSAGES);
      thread.updatedAt = bot.createdAt;
      thread.lastMessage = preview(bot.text);
    }
  }
  await writeChats(db);
  return thread;
}

async function listThreads() {
  const db = await readChats();
  return db.threads.map(summarize);
}

async function markRead(visitorId, who) {
  const vid = String(visitorId || "").trim().slice(0, 64);
  const db = await readChats();
  const thread = db.threads.find((t) => String(t.visitorId) === vid);
  if (!thread) return null;
  if (who === "admin") thread.unreadAdmin = 0;
  if (who === "customer") thread.unreadCustomer = 0;
  await writeChats(db);
  return thread;
}

async function getAutoReply() {
  const db = await readChats();
  return db.autoReply || normalizeAutoReply(null);
}

async function setAutoReply(input) {
  const db = await readChats();
  db.autoReply = normalizeAutoReply({
    enabled: Boolean(input && input.enabled),
    message: input && input.message,
  });
  await writeChats(db);
  return db.autoReply;
}

module.exports = {
  readChats,
  writeChats,
  getThread,
  appendMessage,
  listThreads,
  markRead,
  summarize,
  displayTitle,
  getAutoReply,
  setAutoReply,
};
