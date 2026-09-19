const fs = require("fs");
const path = require("path");
const { readJsonStore, writeJsonStore, blobPutFile, blobGetFile, blobGetJson, hasBlob, isHosted } = require("./blob-store");

const DATA_FILE = path.join(process.cwd(), "data", "products-custom.json");
const TMP_FILE = path.join("/tmp", "shr-products-custom.json");
const BLOB_PATH = "shr-admin/products-db.json";
const REMOVED_SEED_IDS = ["3"];

const CATEGORIES = [
  { id: "cat-mcu", name: "MCU 开发板" },
  { id: "cat-iot", name: "无线 IoT" },
  { id: "cat-sbc", name: "单板计算机" },
  { id: "cat-display", name: "显示套件" },
  { id: "cat-sensor", name: "传感器" },
];

function uniqueIds(list) {
  return Array.from(new Set((list || []).map((x) => String(x).trim()).filter(Boolean)));
}

function allDeletedIds(list) {
  return uniqueIds([...(list || []), ...REMOVED_SEED_IDS]);
}

function unwrapGalleries(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out = {};
  Object.keys(raw).forEach((pid) => {
    const list = Array.isArray(raw[pid]) ? raw[pid] : [];
    out[String(pid)] = list
      .map((item) => {
        if (!item) return null;
        if (typeof item === "string") return { id: item, url: item };
        if (item.url) return { id: String(item.id || item.url), url: String(item.url) };
        return null;
      })
      .filter(Boolean);
  });
  return out;
}

function unwrapCatalog(raw) {
  if (Array.isArray(raw)) return { products: raw, hiddenIds: [], deletedIds: allDeletedIds([]), galleries: {} };
  if (raw && typeof raw === "object") {
    const products = Array.isArray(raw.products) ? raw.products : Array.isArray(raw) ? raw : [];
    return {
      products,
      hiddenIds: uniqueIds(raw.hiddenIds),
      deletedIds: allDeletedIds(raw.deletedIds),
      galleries: unwrapGalleries(raw.galleries),
    };
  }
  return { products: [], hiddenIds: [], deletedIds: allDeletedIds([]), galleries: {} };
}

function mergeProducts(a, b) {
  const map = new Map();
  [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])].forEach((p) => {
    if (!p || p.id == null) return;
    const key = String(p.id);
    const prev = map.get(key);
    if (!prev) {
      map.set(key, p);
      return;
    }
    const prevT = String(prev.updatedAt || prev.createdAt || "");
    const nextT = String(p.updatedAt || p.createdAt || "");
    map.set(key, nextT >= prevT ? { ...prev, ...p } : { ...p, ...prev });
  });
  return Array.from(map.values()).sort((x, y) => Number(y.id) - Number(x.id));
}

function mergeGalleries(a, b) {
  return { ...unwrapGalleries(a), ...unwrapGalleries(b) };
}

function mergeCatalog(a, b) {
  const left = unwrapCatalog(a);
  const right = unwrapCatalog(b);
  const hiddenIds = Array.isArray(b) ? left.hiddenIds : right.hiddenIds;
  const deletedIds = allDeletedIds([...(left.deletedIds || []), ...(right.deletedIds || [])]);
  const deleted = new Set(deletedIds);
  const galleries = Array.isArray(b) ? left.galleries : mergeGalleries(left.galleries, right.galleries);
  deletedIds.forEach((id) => {
    delete galleries[id];
  });
  return {
    products: mergeProducts(left.products, right.products).filter((p) => !deleted.has(String(p.id))),
    hiddenIds: uniqueIds(hiddenIds).filter((id) => !deleted.has(id)),
    deletedIds,
    galleries,
  };
}

async function readCatalog() {
  const raw = await readJsonStore({
    blobPath: BLOB_PATH,
    localPaths: [TMP_FILE, DATA_FILE],
    empty: { products: [], hiddenIds: [], deletedIds: [], galleries: {} },
    merge: mergeCatalog,
  });
  return unwrapCatalog(raw);
}

function readLocalDeletedIds() {
  const ids = [];
  [TMP_FILE, DATA_FILE].forEach((file) => {
    try {
      if (!fs.existsSync(file)) return;
      const raw = JSON.parse(fs.readFileSync(file, "utf8"));
      ids.push(...uniqueIds(raw && raw.deletedIds));
    } catch (_) {}
  });
  return uniqueIds(ids);
}

async function rememberDeletedIds(extra) {
  const ids = uniqueIds(extra);
  ids.push(...readLocalDeletedIds());
  try {
    const fromBlob = await blobGetJson(BLOB_PATH);
    if (fromBlob) ids.push(...uniqueIds(fromBlob.deletedIds));
  } catch (_) {}
  return allDeletedIds(ids);
}

function loadSeedProducts() {
  try {
    const seed = require("../../js/products-data.js");
    return Array.isArray(seed) ? seed : [];
  } catch (_) {
    try {
      const seed = require(path.join(process.cwd(), "js", "products-data.js"));
      return Array.isArray(seed) ? seed : [];
    } catch {
      return [];
    }
  }
}

function listVisibleProducts(catalog) {
  const cat = unwrapCatalog(catalog);
  const hidden = new Set(cat.hiddenIds);
  const deleted = new Set(cat.deletedIds);
  const merged = mergeProducts(loadSeedProducts(), cat.products);
  return attachGalleries(merged, cat.galleries).filter(
    (p) => !hidden.has(String(p.id)) && !deleted.has(String(p.id))
  );
}

async function writeCatalog(catalog) {
  const incoming = unwrapCatalog(catalog);
  const deletedIds = await rememberDeletedIds(incoming.deletedIds);
  const deleted = new Set(deletedIds);
  const galleries = { ...incoming.galleries };
  deletedIds.forEach((id) => {
    delete galleries[id];
  });
  const next = {
    products: incoming.products.filter((p) => !deleted.has(String(p.id))),
    hiddenIds: uniqueIds(incoming.hiddenIds).filter((id) => !deleted.has(id)),
    deletedIds,
    galleries,
  };
  await writeJsonStore({
    blobPath: BLOB_PATH,
    localPaths: [TMP_FILE, DATA_FILE],
    data: next,
  });
  return next;
}

async function readCustomProducts() {
  return (await readCatalog()).products;
}

async function writeCustomProducts(list) {
  const cur = await readCatalog();
  const saved = await writeCatalog({
    products: list,
    hiddenIds: cur.hiddenIds,
    deletedIds: cur.deletedIds,
    galleries: cur.galleries,
  });
  return saved.products;
}

async function setProductsHidden(ids, hidden) {
  const cur = await readCatalog();
  const set = new Set(cur.hiddenIds);
  uniqueIds(ids).forEach((id) => {
    if (hidden) set.add(id);
    else set.delete(id);
  });
  return writeCatalog({
    products: cur.products,
    hiddenIds: Array.from(set),
    deletedIds: cur.deletedIds,
    galleries: cur.galleries,
  });
}

async function deleteProducts(ids) {
  const remove = uniqueIds(ids);
  if (!remove.length) throw new Error("ids required");
  const cur = await readCatalog();
  const removeSet = new Set(remove);
  const products = (cur.products || []).filter((p) => !removeSet.has(String(p.id)));
  const hiddenIds = (cur.hiddenIds || []).filter((id) => !removeSet.has(String(id)));
  const deletedIds = uniqueIds([...(cur.deletedIds || []), ...remove]);
  const galleries = { ...(cur.galleries || {}) };
  remove.forEach((id) => {
    delete galleries[id];
  });
  return writeCatalog({ products, hiddenIds, deletedIds, galleries });
}

const MAX_GALLERY = 12;

async function addGalleryImages(productId, payloads) {
  const pid = String(productId || "").trim();
  if (!pid) throw new Error("product id required");
  const cur = await readCatalog();
  const list = Array.isArray(cur.galleries[pid]) ? cur.galleries[pid].slice() : [];
  const incoming = Array.isArray(payloads) ? payloads : [];
  for (const item of incoming) {
    if (list.length >= MAX_GALLERY) break;
    const raw = item && (item.imageBase64 || item.base64 || item);
    if (!raw) continue;
    const imageId = `g${pid}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const url = await saveProductImage(imageId, raw, item.imageType || item.type);
    list.push({ id: imageId, url });
  }
  cur.galleries[pid] = list;
  await writeCatalog(cur);
  return list;
}

async function removeGalleryImage(productId, imageId) {
  const pid = String(productId || "").trim();
  const iid = String(imageId || "").trim();
  const cur = await readCatalog();
  const list = Array.isArray(cur.galleries[pid]) ? cur.galleries[pid] : [];
  cur.galleries[pid] = list.filter((img) => String(img.id) !== iid);
  await writeCatalog(cur);
  return cur.galleries[pid];
}

function attachGalleries(products, galleries) {
  const map = unwrapGalleries(galleries);
  return (products || []).map((p) => ({
    ...p,
    images: map[String(p.id)] || p.images || [],
  }));
}

function categoryName(id) {
  const found = CATEGORIES.find((c) => c.id === id);
  return found ? found.name : "其他";
}

function nextProductId(existingIds) {
  const nums = (existingIds || []).map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0);
  const max = nums.length ? Math.max(...nums) : 0;
  return max + 1;
}

function normalizeProduct(input, { id, existingIds } = {}) {
  const categoryId = String(input.categoryId || "cat-mcu").trim();
  const name = String(input.name || "").trim();
  const price = Number(input.price);
  if (!name) throw new Error("name required");
  if (!Number.isFinite(price) || price < 0) throw new Error("invalid price");

  const features = Array.isArray(input.features)
    ? input.features.map((x) => String(x).trim()).filter(Boolean)
    : String(input.featuresText || "")
        .split(/\n|；|;/)
        .map((x) => x.trim())
        .filter(Boolean);

  const packageList = Array.isArray(input.package)
    ? input.package.map((x) => String(x).trim()).filter(Boolean)
    : String(input.packageText || "")
        .split(/\n|；|;/)
        .map((x) => x.trim())
        .filter(Boolean);

  const productId = id != null ? Number(id) : nextProductId(existingIds);

  return {
    id: productId,
    name,
    desc: String(input.desc || "").trim() || name,
    price: Math.round(price * 100) / 100,
    tag: String(input.tag || "新品").trim() || "新品",
    category: String(input.category || categoryName(categoryId)).trim(),
    categoryId,
    img: String(input.img || "/images/stm32.jpg").trim() || "/images/stm32.jpg",
    intro: String(input.intro || input.desc || name).trim(),
    features: features.length ? features : ["详情请见商品页"],
    specs: Array.isArray(input.specs) ? input.specs : [],
    pins: Array.isArray(input.pins) ? input.pins : [],
    package: packageList.length ? packageList : ["商品本体 ×1"],
    downloads: Array.isArray(input.downloads) ? input.downloads : [],
    custom: true,
    updatedAt: new Date().toISOString(),
    createdAt: input.createdAt || new Date().toISOString(),
  };
}

function productImageBlobPath(id) {
  return `shr-admin/product-images/${String(id)}`;
}

function decodeImagePayload(raw, typeHint) {
  const text = String(raw || "");
  const match = text.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  const mime = match ? match[1] : String(typeHint || "image/jpeg").split(";")[0];
  const b64 = match ? match[2] : text;
  const buffer = Buffer.from(b64, "base64");
  if (!buffer.length) throw new Error("invalid image");
  if (buffer.length > 4.2 * 1024 * 1024) throw new Error("image too large");
  const safeType = /^image\/(jpeg|png|webp|gif)$/.test(mime) ? mime : "image/jpeg";
  return { buffer, contentType: safeType };
}

async function saveProductImage(id, raw, typeHint) {
  const { buffer, contentType } = decodeImagePayload(raw, typeHint);
  const blobPath = productImageBlobPath(id);
  if (hasBlob()) {
    await blobPutFile(blobPath, buffer, contentType);
  } else if (isHosted()) {
    const err = new Error("Cloudflare R2 is not configured");
    err.code = "BLOB_MISSING";
    throw err;
  } else {
    const dir = path.join(process.cwd(), "images", "uploads");
    fs.mkdirSync(dir, { recursive: true });
    const ext = contentType === "image/png" ? ".png" : contentType === "image/webp" ? ".webp" : ".jpg";
    fs.writeFileSync(path.join(dir, `${id}${ext}`), buffer);
    return `/images/uploads/${id}${ext}`;
  }
  return `/api/products?img=${encodeURIComponent(id)}&v=${Date.now()}`;
}

async function readProductImage(id) {
  const file = await blobGetFile(productImageBlobPath(id));
  if (file) return file;
  const dir = path.join(process.cwd(), "images", "uploads");
  for (const ext of [".jpg", ".jpeg", ".png", ".webp", ".gif"]) {
    const abs = path.join(dir, `${id}${ext}`);
    if (fs.existsSync(abs)) {
      const type =
        ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : ext === ".gif" ? "image/gif" : "image/jpeg";
      return { buffer: fs.readFileSync(abs), contentType: type };
    }
  }
  return null;
}

module.exports = {
  CATEGORIES,
  readCatalog,
  writeCatalog,
  readCustomProducts,
  writeCustomProducts,
  setProductsHidden,
  deleteProducts,
  normalizeProduct,
  nextProductId,
  categoryName,
  saveProductImage,
  readProductImage,
  addGalleryImages,
  removeGalleryImage,
  attachGalleries,
  listVisibleProducts,
  loadSeedProducts,
  MAX_GALLERY,
};
