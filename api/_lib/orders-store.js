const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(process.cwd(), "data", "orders.json");
const TMP_FILE = path.join("/tmp", "shr-orders.json");

function readOrders() {
  try {
    if (fs.existsSync(TMP_FILE)) return JSON.parse(fs.readFileSync(TMP_FILE, "utf8"));
  } catch (_) {}
  try {
    if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch (_) {}
  return [];
}

function writeOrders(orders) {
  const list = (orders || []).slice(0, 500);
  const text = JSON.stringify(list, null, 2);
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, text);
  } catch (_) {}
  try {
    fs.writeFileSync(TMP_FILE, text);
  } catch (_) {}
  return list;
}

function normalizePhone(phone) {
  return String(phone || "").replace(/\s|-/g, "");
}

function findOrder(id, phone) {
  const oid = String(id || "").toUpperCase();
  const p = normalizePhone(phone);
  return readOrders().find(
    (o) =>
      String(o.id).toUpperCase() === oid && normalizePhone(o.shipping && o.shipping.phone) === p
  );
}

function monthKey(iso) {
  const d = new Date(iso || Date.now());
  if (Number.isNaN(d.getTime())) return "unknown";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function buildStats(orders) {
  const list = orders || readOrders();
  const byMonth = {};
  let totalAmount = 0;
  let totalOrders = list.length;

  list.forEach((o) => {
    const amount = Number(o.total) || 0;
    totalAmount += amount;
    const key = monthKey(o.createdAt);
    if (!byMonth[key]) byMonth[key] = { month: key, orders: 0, amount: 0, items: 0 };
    byMonth[key].orders += 1;
    byMonth[key].amount += amount;
    byMonth[key].items += (o.items || []).reduce((s, i) => s + (Number(i.qty) || 0), 0);
  });

  const monthly = Object.values(byMonth).sort((a, b) => String(b.month).localeCompare(String(a.month)));
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const current = byMonth[thisMonth] || { month: thisMonth, orders: 0, amount: 0, items: 0 };

  return {
    totalOrders,
    totalAmount: Math.round(totalAmount * 100) / 100,
    thisMonth: current,
    monthly,
  };
}

function extractCustomers(orders) {
  const map = new Map();
  (orders || readOrders()).forEach((o) => {
    const s = o.shipping || {};
    const phone = normalizePhone(s.phone);
    if (!phone) return;
    const prev = map.get(phone) || {
      phone,
      name: s.name || "",
      email: s.email || "",
      region: s.region || "",
      address: s.address || "",
      orderCount: 0,
      totalSpent: 0,
      lastOrderAt: null,
      lastOrderId: null,
    };
    prev.orderCount += 1;
    prev.totalSpent += Number(o.total) || 0;
    if (!prev.name && s.name) prev.name = s.name;
    if (!prev.email && s.email) prev.email = s.email;
    if (!prev.region && s.region) prev.region = s.region;
    if (!prev.address && s.address) prev.address = s.address;
    if (!prev.lastOrderAt || String(o.createdAt) > String(prev.lastOrderAt)) {
      prev.lastOrderAt = o.createdAt;
      prev.lastOrderId = o.id;
    }
    map.set(phone, prev);
  });
  return Array.from(map.values())
    .map((c) => ({ ...c, totalSpent: Math.round(c.totalSpent * 100) / 100 }))
    .sort((a, b) => String(b.lastOrderAt || "").localeCompare(String(a.lastOrderAt || "")));
}

module.exports = {
  readOrders,
  writeOrders,
  findOrder,
  buildStats,
  extractCustomers,
  normalizePhone,
};
