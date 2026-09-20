const path = require("path");
const { readJsonStore, writeJsonStore } = require("./blob-store");
const { readOrders } = require("./orders-store");

const DATA_FILE = path.join(process.cwd(), "data", "warehouses.json");
const TMP_FILE = path.join("/tmp", "shr-warehouses.json");
const BLOB_PATH = "shr-auth/warehouses-db.json";

function nowIso() {
  return new Date().toISOString();
}

function emptyWarehouse(user) {
  return {
    userId: user && user.id ? String(user.id) : "",
    email: user && user.email ? String(user.email).trim().toLowerCase() : "",
    createdAt: nowIso(),
    updatedAt: nowIso(),
    cart: [],
    addresses: [],
    purchases: [],
  };
}

function sanitizeCartItem(item) {
  if (!item || item.id == null) return null;
  const qty = Math.max(1, Math.min(99, Number(item.qty) || 1));
  const price = Number(item.price);
  return {
    id: item.id,
    name: String(item.name || "").slice(0, 160),
    price: Number.isFinite(price) ? price : 0,
    img: String(item.img || "").slice(0, 500),
    qty,
  };
}

function sanitizeCart(list) {
  const map = new Map();
  (Array.isArray(list) ? list : []).forEach((item) => {
    const row = sanitizeCartItem(item);
    if (!row) return;
    const key = String(row.id);
    const prev = map.get(key);
    if (!prev) map.set(key, row);
    else map.set(key, { ...prev, ...row, qty: Math.max(prev.qty, row.qty) });
  });
  return Array.from(map.values()).slice(0, 50);
}

function addressKey(addr) {
  if (!addr) return "";
  return [addr.name, addr.phone, addr.region, addr.address]
    .map((v) => String(v || "").trim().toLowerCase().replace(/\s+/g, " "))
    .join("|");
}

function sanitizeAddress(addr, fallbackId) {
  if (!addr) return null;
  const name = String(addr.name || "").trim().slice(0, 80);
  const phone = String(addr.phone || "").trim().slice(0, 32);
  const region = String(addr.region || "").trim().slice(0, 120);
  const address = String(addr.address || "").trim().slice(0, 240);
  if (!name || !phone || !region || !address) return null;
  return {
    id: String(addr.id || fallbackId || `a${Date.now()}`).slice(0, 40),
    name,
    phone,
    email: String(addr.email || "").trim().slice(0, 120),
    region,
    zip: String(addr.zip || "").trim().slice(0, 20),
    address,
    note: String(addr.note || "").trim().slice(0, 120),
    createdAt: addr.createdAt || nowIso(),
  };
}

function sanitizeAddresses(list) {
  const map = new Map();
  (Array.isArray(list) ? list : []).forEach((addr) => {
    const row = sanitizeAddress(addr);
    if (!row) return;
    const key = addressKey(row);
    const prev = map.get(key);
    if (!prev) map.set(key, row);
    else map.set(key, { ...row, id: prev.id, createdAt: prev.createdAt || row.createdAt });
  });
  return Array.from(map.values())
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    .slice(0, 20);
}

function sanitizePurchase(order) {
  const id = order && (order.orderId || order.id);
  if (!id) return null;
  const shipping = order.shipping && typeof order.shipping === "object" ? order.shipping : {};
  return {
    orderId: String(id).slice(0, 40),
    createdAt: order.createdAt || nowIso(),
    status: String(order.status || "").slice(0, 80),
    payMethod: String(order.payMethod || "").slice(0, 40),
    total: Number(order.total) || 0,
    items: sanitizeCart(order.items),
    shipping: {
      name: String(shipping.name || "").slice(0, 80),
      phone: String(shipping.phone || "").slice(0, 32),
      email: String(shipping.email || "").slice(0, 120),
      region: String(shipping.region || "").slice(0, 120),
      zip: String(shipping.zip || "").slice(0, 20),
      address: String(shipping.address || "").slice(0, 240),
    },
  };
}

function sanitizePurchases(list) {
  const map = new Map();
  (Array.isArray(list) ? list : []).forEach((row) => {
    const purchase = sanitizePurchase(row);
    if (!purchase) return;
    const prev = map.get(purchase.orderId);
    if (!prev || String(purchase.createdAt) >= String(prev.createdAt)) map.set(purchase.orderId, purchase);
  });
  return Array.from(map.values())
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    .slice(0, 100);
}

function normalizeWarehouse(raw, user) {
  const base = emptyWarehouse(user);
  const data = raw && typeof raw === "object" ? raw : {};
  return {
    userId: String(data.userId || base.userId),
    email: String(data.email || base.email).trim().toLowerCase(),
    createdAt: data.createdAt || base.createdAt,
    updatedAt: data.updatedAt || base.updatedAt,
    cart: sanitizeCart(data.cart),
    addresses: sanitizeAddresses(data.addresses),
    purchases: sanitizePurchases(data.purchases),
  };
}

function warehouseMatchesUser(row, user) {
  if (!row || !user) return false;
  const id = String(user.id || "").trim();
  const email = String(user.email || "").trim().toLowerCase();
  if (id && String(row.userId || "") === id) return true;
  if (email && String(row.email || "").trim().toLowerCase() === email) return true;
  return false;
}

function mergeList(a, b) {
  const map = new Map();
  function put(row) {
    if (!row) return;
    const key = String(row.userId || row.email || "").trim().toLowerCase();
    if (!key) return;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, row);
      return;
    }
    const newer = String(row.updatedAt || "") >= String(prev.updatedAt || "") ? row : prev;
    const older = newer === row ? prev : row;
    map.set(key, {
      ...older,
      ...newer,
      createdAt: older.createdAt || newer.createdAt,
      cart: sanitizeCart([...(older.cart || []), ...(newer.cart || [])]),
      addresses: sanitizeAddresses([...(older.addresses || []), ...(newer.addresses || [])]),
      purchases: sanitizePurchases([...(older.purchases || []), ...(newer.purchases || [])]),
    });
  }
  (Array.isArray(a) ? a : []).forEach(put);
  (Array.isArray(b) ? b : []).forEach(put);
  return Array.from(map.values());
}

async function readAll() {
  const list = await readJsonStore({
    blobPath: BLOB_PATH,
    localPaths: [TMP_FILE, DATA_FILE],
    empty: [],
    merge: mergeList,
  });
  return Array.isArray(list) ? list : [];
}

async function writeAll(list) {
  const next = mergeList([], list);
  await writeJsonStore({
    blobPath: BLOB_PATH,
    localPaths: [TMP_FILE, DATA_FILE],
    data: next,
  });
  return next;
}

function orderMatchesUser(order, user) {
  if (!order || !user) return false;
  const id = String(user.id || "").trim();
  const email = String(user.email || "").trim().toLowerCase();
  if (id && String(order.userId || "") === id) return true;
  if (email && String(order.userEmail || "").trim().toLowerCase() === email) return true;
  const shipEmail = String((order.shipping && order.shipping.email) || "").trim().toLowerCase();
  if (email && shipEmail && shipEmail === email) return true;
  return false;
}

async function backfillFromOrders(warehouse, user) {
  let orders = [];
  try {
    orders = await readOrders();
  } catch (_) {
    orders = [];
  }
  const mine = (Array.isArray(orders) ? orders : []).filter((o) => orderMatchesUser(o, user));
  if (!mine.length) return { warehouse, changed: false };
  const purchases = sanitizePurchases([
    ...warehouse.purchases,
    ...mine.map((o) => sanitizePurchase(o)).filter(Boolean),
  ]);
  const addresses = sanitizeAddresses([
    ...warehouse.addresses,
    ...mine.map((o) => sanitizeAddress(o.shipping, o.id ? `ord-${o.id}` : "")).filter(Boolean),
  ]);
  const changed =
    purchases.length !== warehouse.purchases.length || addresses.length !== warehouse.addresses.length;
  if (!changed) return { warehouse, changed: false };
  return {
    warehouse: {
      ...warehouse,
      purchases,
      addresses,
      updatedAt: nowIso(),
    },
    changed: true,
  };
}

async function ensureWarehouse(user) {
  const list = await readAll();
  const idx = list.findIndex((row) => warehouseMatchesUser(row, user));
  let warehouse = idx >= 0 ? normalizeWarehouse(list[idx], user) : emptyWarehouse(user);
  warehouse.userId = warehouse.userId || String(user.id || "");
  warehouse.email = warehouse.email || String(user.email || "").trim().toLowerCase();
  const filled = await backfillFromOrders(warehouse, user);
  warehouse = filled.warehouse;
  if (idx < 0 || filled.changed) {
    if (idx >= 0) list[idx] = warehouse;
    else list.unshift(warehouse);
    await writeAll(list);
  }
  return warehouse;
}

async function patchWarehouse(user, patch) {
  const list = await readAll();
  const idx = list.findIndex((row) => warehouseMatchesUser(row, user));
  const current = idx >= 0 ? normalizeWarehouse(list[idx], user) : emptyWarehouse(user);
  let next = { ...current };
  if (patch && Array.isArray(patch.cart)) next.cart = sanitizeCart(patch.cart);
  if (patch && Array.isArray(patch.addresses)) next.addresses = sanitizeAddresses(patch.addresses);
  if (patch && patch.address) {
    next.addresses = sanitizeAddresses([patch.address, ...next.addresses]);
  }
  if (patch && patch.removeAddressId) {
    const rid = String(patch.removeAddressId);
    next.addresses = next.addresses.filter((a) => String(a.id) !== rid);
  }
  if (patch && patch.order) {
    const purchase = sanitizePurchase(patch.order);
    if (purchase) next.purchases = sanitizePurchases([purchase, ...next.purchases]);
    if (patch.order.shipping) {
      next.addresses = sanitizeAddresses([patch.order.shipping, ...next.addresses]);
    }
  }
  next.userId = next.userId || String(user.id || "");
  next.email = next.email || String(user.email || "").trim().toLowerCase();
  next.updatedAt = nowIso();
  if (idx >= 0) list[idx] = next;
  else list.unshift(next);
  await writeAll(list);
  return next;
}

function userHintMatches(row, ids) {
  const set = ids instanceof Set ? ids : new Set(Array.isArray(ids) ? ids.map((v) => String(v).trim()) : []);
  if (!row) return false;
  const id = String(row.userId || "").trim();
  const email = String(row.email || "").trim().toLowerCase();
  return (id && set.has(id)) || (email && set.has(email));
}

async function deleteWarehouses(ids) {
  const list = Array.isArray(ids) ? ids : ids != null ? [ids] : [];
  const set = new Set(
    list.flatMap((id) => {
      const s = String(id || "").trim();
      return s ? [s, s.toLowerCase()] : [];
    })
  );
  if (!set.size) return readAll();
  const current = await readAll();
  return writeAll(current.filter((row) => !userHintMatches(row, set)));
}

async function clearWarehouses() {
  return writeAll([]);
}

module.exports = {
  emptyWarehouse,
  ensureWarehouse,
  patchWarehouse,
  deleteWarehouses,
  clearWarehouses,
  sanitizeCart,
};
