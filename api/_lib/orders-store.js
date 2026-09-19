const path = require("path");
const { readJsonStore, writeJsonStore } = require("./blob-store");

const DATA_FILE = path.join(process.cwd(), "data", "orders.json");
const TMP_FILE = path.join("/tmp", "shr-orders.json");
const BLOB_PATH = "shr-admin/orders-db.json";

function mergeOrders(a, b) {
  const map = new Map();
  [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])].forEach((o) => {
    if (!o || !o.id) return;
    const key = String(o.id);
    const prev = map.get(key);
    if (!prev) {
      map.set(key, o);
      return;
    }
    const prevT = String(prev.updatedAt || prev.createdAt || "");
    const nextT = String(o.updatedAt || o.createdAt || "");
    map.set(key, nextT >= prevT ? { ...prev, ...o } : { ...o, ...prev });
  });
  return Array.from(map.values())
    .sort((x, y) => String(y.createdAt || "").localeCompare(String(x.createdAt || "")))
    .slice(0, 500);
}

async function readOrders() {
  const list = await readJsonStore({
    blobPath: BLOB_PATH,
    localPaths: [TMP_FILE, DATA_FILE],
    empty: [],
    merge: mergeOrders,
  });
  return Array.isArray(list) ? list : [];
}

async function writeOrders(orders) {
  const list = mergeOrders([], orders).slice(0, 500);
  await writeJsonStore({
    blobPath: BLOB_PATH,
    localPaths: [TMP_FILE, DATA_FILE],
    data: list,
  });
  return list;
}

function normalizePhone(phone) {
  return String(phone || "").replace(/\s|-/g, "");
}

async function findOrder(id, phone) {
  const oid = String(id || "").toUpperCase();
  const p = normalizePhone(phone);
  const orders = await readOrders();
  return orders.find(
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
  const list = Array.isArray(orders) ? orders : [];
  const byMonth = {};
  let totalAmount = 0;
  const totalOrders = list.length;

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
  (Array.isArray(orders) ? orders : []).forEach((o) => {
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

function extractAddressStats(orders) {
  const map = new Map();
  (Array.isArray(orders) ? orders : []).forEach((o) => {
    const s = o.shipping || {};
    const region = String(s.region || "").trim() || "未填写地区";
    const address = String(s.address || "").trim();
    const full = address ? `${region} ${address}` : region;
    const phone = normalizePhone(s.phone);
    const prev = map.get(full) || {
      region,
      address,
      fullAddress: full,
      orderCount: 0,
      amount: 0,
      phones: new Set(),
      names: new Set(),
    };
    prev.orderCount += 1;
    prev.amount += Number(o.total) || 0;
    if (phone) prev.phones.add(phone);
    if (s.name) prev.names.add(String(s.name).trim());
    map.set(full, prev);
  });

  return Array.from(map.values())
    .map((row) => ({
      region: row.region,
      address: row.address,
      fullAddress: row.fullAddress,
      orderCount: row.orderCount,
      customerCount: row.phones.size,
      amount: Math.round(row.amount * 100) / 100,
      sampleNames: Array.from(row.names).slice(0, 3).join("、"),
    }))
    .sort((a, b) => b.orderCount - a.orderCount || b.amount - a.amount);
}

module.exports = {
  readOrders,
  writeOrders,
  findOrder,
  buildStats,
  extractCustomers,
  extractAddressStats,
  normalizePhone,
};
