const fs = require("fs");
const path = require("path");
const { readJsonStore, writeJsonStore, blobPutFile, blobGetFile, hasBlob, isVercel } = require("./blob-store");

const DATA_FILE = path.join(process.cwd(), "data", "products-custom.json");
const TMP_FILE = path.join("/tmp", "shr-products-custom.json");
const BLOB_PATH = "shr-admin/products-db.json";

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

function unwrapCatalog(raw) {
  if (Array.isArray(raw)) return { products: raw, hiddenIds: [] };
  if (raw && typeof raw === "object") {
    const products = Array.isArray(raw.products) ? raw.products : Array.isArray(raw) ? raw : [];
    return { products, hiddenIds: uniqueIds(raw.hiddenIds) };
  }
  return { products: [], hiddenIds: [] };
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

function mergeCatalog(a, b) {
  const left = unwrapCatalog(a);
  const right = unwrapCatalog(b);
  const hiddenIds = Array.isArray(b) ? left.hiddenIds : right.hiddenIds;
  return {
    products: mergeProducts(left.products, right.products),
    hiddenIds,
  };
}

async function readCatalog() {
  const raw = await readJsonStore({
    blobPath: BLOB_PATH,
    localPaths: [TMP_FILE, DATA_FILE],
    empty: { products: [], hiddenIds: [] },
    merge: mergeCatalog,
  });
  return unwrapCatalog(raw);
}

async function writeCatalog(catalog) {
  const next = {
    products: mergeProducts([], catalog && catalog.products),
    hiddenIds: uniqueIds(catalog && catalog.hiddenIds),
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
  const saved = await writeCatalog({ products: list, hiddenIds: cur.hiddenIds });
  return saved.products;
}

async function setProductsHidden(ids, hidden) {
  const cur = await readCatalog();
  const set = new Set(cur.hiddenIds);
  uniqueIds(ids).forEach((id) => {
    if (hidden) set.add(id);
    else set.delete(id);
  });
  return writeCatalog({ products: cur.products, hiddenIds: Array.from(set) });
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
  } else if (isVercel()) {
    const err = new Error("BLOB_STORE_ID / BLOB_READ_WRITE_TOKEN not configured");
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
  normalizeProduct,
  nextProductId,
  categoryName,
  saveProductImage,
  readProductImage,
};
