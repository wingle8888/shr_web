const fs = require("fs");
const path = require("path");
const { readJsonStore, writeJsonStore, blobPutFile, blobGetFile, blobGetJson, hasBlob, isHosted } = require("./blob-store");

const DATA_FILE = path.join(process.cwd(), "data", "products-custom.json");
const TMP_FILE = path.join("/tmp", "shr-products-custom.json");
const BLOB_PATH = "shr-admin/products-db.json";
const REMOVED_SEED_IDS = ["3", "6"];
const MAX_GALLERY = 12;
const MAX_CAPTION = 200;

function clipCaption(value) {
  return String(value || "").trim().slice(0, MAX_CAPTION);
}

const DEFAULT_CATEGORIES = [
  { id: "cat-mcu", name: "MCU 开发板", nameEn: "MCU Boards", desc: "STM32 / Arduino 等高性能与入门 MCU 板卡", descEn: "STM32 / Arduino and other MCU development boards", nameKey: "catMcu", descKey: "catMcuDesc" },
  { id: "cat-iot", name: "无线 IoT", nameEn: "Wireless IoT", desc: "Wi‑Fi / BLE 物联网模组与开发套件", descEn: "Wi‑Fi / BLE IoT modules and kits", nameKey: "catIot", descKey: "catIotDesc" },
  { id: "cat-sbc", name: "单板计算机", nameEn: "Single Board PC", desc: "Raspberry Pi 等 Linux 单板机", descEn: "Raspberry Pi and other Linux SBCs", nameKey: "catSbc", descKey: "catSbcDesc" },
  { id: "cat-display", name: "显示套件", nameEn: "Display Kits", desc: "触摸屏与 LVGL 人机界面方案", descEn: "Touchscreens and LVGL HMI solutions", nameKey: "catDisplay", descKey: "catDisplayDesc" },
  { id: "cat-sensor", name: "传感器", nameEn: "Sensors", desc: "姿态、环境等传感器模块", descEn: "Motion, environment and other sensor modules", nameKey: "catSensor", descKey: "catSensorDesc" },
];
const CATEGORIES = DEFAULT_CATEGORIES;
const MAX_CATEGORIES = 24;

function unwrapCategories(raw) {
  if (!Array.isArray(raw)) return null;
  return raw
    .map((item) => {
      if (!item) return null;
      const id = String(item.id || "").trim().slice(0, 64);
      const name = String(item.name || "").trim().slice(0, 40);
      if (!id || !name) return null;
      return {
        id,
        name,
        desc: String(item.desc || "").trim().slice(0, 80),
        nameEn: String(item.nameEn || "").trim().slice(0, 40),
        descEn: String(item.descEn || "").trim().slice(0, 80),
        nameKey: String(item.nameKey || "").trim(),
        descKey: String(item.descKey || "").trim(),
      };
    })
    .filter(Boolean);
}

function catalogCategories(catalog) {
  const list = unwrapCategories(catalog && catalog.categories);
  if (list && list.length) return list;
  return DEFAULT_CATEGORIES.map((c) => ({ ...c }));
}

function slugCategoryId(name, existing) {
  const used = new Set((existing || []).map((c) => String(c.id)));
  let base = String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\u4e00-\u9fff-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
  if (!base) base = Date.now().toString(36);
  let id = `cat-${base}`;
  let n = 2;
  while (used.has(id)) {
    id = `cat-${base}-${n}`;
    n += 1;
  }
  return id.slice(0, 64);
}

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
        if (typeof item === "string") return { id: item, url: item, caption: "" };
        if (item.url) {
          return {
            id: String(item.id || item.url),
            url: String(item.url),
            caption: clipCaption(item.caption),
            captionEn: clipCaption(item.captionEn),
          };
        }
        return null;
      })
      .filter(Boolean);
  });
  return out;
}

function unwrapCatalog(raw) {
  if (Array.isArray(raw)) return { products: raw, hiddenIds: [], deletedIds: allDeletedIds([]), galleries: {}, categories: null, currency: "", updatedAt: "" };
  if (raw && typeof raw !== "object") {
    return { products: [], hiddenIds: [], deletedIds: allDeletedIds([]), galleries: {}, categories: null, currency: "", updatedAt: "" };
  }
  if (raw && typeof raw === "object") {
    const products = Array.isArray(raw.products) ? raw.products : Array.isArray(raw) ? raw : [];
    return {
      products,
      hiddenIds: uniqueIds(raw.hiddenIds),
      deletedIds: allDeletedIds(raw.deletedIds),
      galleries: unwrapGalleries(raw.galleries),
      categories: unwrapCategories(raw.categories),
      currency: String(raw.currency || ""),
      updatedAt: String(raw.updatedAt || ""),
    };
  }
  return { products: [], hiddenIds: [], deletedIds: allDeletedIds([]), galleries: {}, categories: null, currency: "", updatedAt: "" };
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

function catalogTime(raw) {
  return String((raw && raw.updatedAt) || "");
}

function pickHiddenIds(left, right, rawRight) {
  if (Array.isArray(rawRight)) return left.hiddenIds;
  const leftT = catalogTime(left);
  const rightT = catalogTime(right);
  if (leftT && rightT) return rightT >= leftT ? right.hiddenIds : left.hiddenIds;
  if (leftT && !rightT) return left.hiddenIds;
  if (rightT && !leftT) return right.hiddenIds;
  return uniqueIds([...(left.hiddenIds || []), ...(right.hiddenIds || [])]);
}

function pickCategories(left, right, rawRight) {
  if (Array.isArray(rawRight)) return left.categories;
  const leftT = catalogTime(left);
  const rightT = catalogTime(right);
  const leftCats = unwrapCategories(left.categories);
  const rightCats = unwrapCategories(right.categories);
  const hasL = Boolean(leftCats && leftCats.length);
  const hasR = Boolean(rightCats && rightCats.length);
  if (hasL && hasR) return rightT >= leftT ? rightCats : leftCats;
  if (hasR) return rightCats;
  if (hasL) return leftCats;
  return null;
}

function mergeCatalog(a, b) {
  const left = unwrapCatalog(a);
  const right = unwrapCatalog(b);
  const hiddenIds = pickHiddenIds(left, right, b);
  const deletedIds = allDeletedIds([...(left.deletedIds || []), ...(right.deletedIds || [])]);
  const deleted = new Set(deletedIds);
  const galleries = Array.isArray(b) ? left.galleries : mergeGalleries(left.galleries, right.galleries);
  deletedIds.forEach((id) => {
    delete galleries[id];
  });
  const updatedAt = [catalogTime(left), catalogTime(right)].sort().pop() || "";
  return {
    products: mergeProducts(left.products, right.products).filter((p) => !deleted.has(String(p.id))),
    hiddenIds: uniqueIds(hiddenIds).filter((id) => !deleted.has(id)),
    deletedIds,
    galleries,
    categories: pickCategories(left, right, b),
    currency: left.currency === "USD" || right.currency === "USD" ? "USD" : left.currency || right.currency || "",
    updatedAt,
  };
}

const CNY_PER_USD = 7.2;

function toUsdPrice(price) {
  const n = Number(price);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round((n / CNY_PER_USD) * 100) / 100;
}

function convertCatalogPricesToUsd(cat) {
  if (!cat || cat.currency === "USD") return cat;
  return {
    ...cat,
    currency: "USD",
    products: (cat.products || []).map((p) => ({
      ...p,
      price: toUsdPrice(p.price),
    })),
  };
}

async function readCatalog() {
  const raw = await readJsonStore({
    blobPath: BLOB_PATH,
    localPaths: [TMP_FILE, DATA_FILE],
    empty: { products: [], hiddenIds: [], deletedIds: [], galleries: {}, categories: [], currency: "USD" },
    merge: mergeCatalog,
  });
  const cat = convertCatalogPricesToUsd(unwrapCatalog(raw));
  cat.categories = catalogCategories(cat);
  if (unwrapCatalog(raw).currency !== "USD") {
    try {
      await writeCatalog(cat);
    } catch (_) {}
  }
  return cat;
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
    categories: catalogCategories(incoming),
    currency: "USD",
    updatedAt: new Date().toISOString(),
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
    categories: cur.categories,
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
    categories: cur.categories,
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
  return writeCatalog({ products, hiddenIds, deletedIds, galleries, categories: cur.categories });
}

async function addCategory(input) {
  const name = String((input && input.name) || "").trim().slice(0, 40);
  if (!name) throw new Error("分类名称不能为空");
  const desc = String((input && input.desc) || "").trim().slice(0, 80);
  const cur = await readCatalog();
  const list = catalogCategories(cur);
  if (list.length >= MAX_CATEGORIES) throw new Error("分类数量已满");
  if (list.some((c) => c.name === name)) throw new Error("分类名称已存在");
  list.push({
    id: slugCategoryId(name, list),
    name,
    desc,
  });
  cur.categories = list;
  await writeCatalog(cur);
  return list;
}

async function removeCategory(id) {
  const cid = String(id || "").trim();
  if (!cid) throw new Error("category id required");
  const cur = await readCatalog();
  const list = catalogCategories(cur);
  if (list.length <= 1) throw new Error("至少保留一个分类");
  if (!list.some((c) => c.id === cid)) throw new Error("分类不存在");
  cur.categories = list.filter((c) => c.id !== cid);
  await writeCatalog(cur);
  return cur.categories;
}

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
    list.push({
      id: imageId,
      url,
      caption: clipCaption(item.caption),
      captionEn: clipCaption(item.captionEn),
    });
  }
  cur.galleries[pid] = list;
  await writeCatalog(cur);
  return list;
}

async function updateGalleryCaption(productId, imageId, caption) {
  const pid = String(productId || "").trim();
  const iid = String(imageId || "").trim();
  if (!pid || !iid) throw new Error("product id and image id required");
  const cur = await readCatalog();
  const list = Array.isArray(cur.galleries[pid]) ? cur.galleries[pid] : [];
  const text = clipCaption(caption);
  cur.galleries[pid] = list.map((img) => (String(img.id) === iid ? { ...img, caption: text } : img));
  await writeCatalog(cur);
  return cur.galleries[pid];
}

async function setGalleryImages(productId, images) {
  const pid = String(productId || "").trim();
  if (!pid) throw new Error("product id required");
  const cur = await readCatalog();
  const list = [];
  const incoming = Array.isArray(images) ? images : [];
  for (const item of incoming) {
    if (list.length >= MAX_GALLERY) break;
    if (!item) continue;
    let url = String(item.url || "").trim();
    let imageId = String(item.id || "").trim();
    if (item.imageBase64) {
      imageId = imageId || `g${pid}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      url = await saveProductImage(imageId, item.imageBase64, item.imageType || item.type);
    }
    if (!url || url.indexOf("blob:") === 0) continue;
    if (!imageId) imageId = url;
    list.push({
      id: imageId,
      url,
      caption: clipCaption(item.caption),
      captionEn: clipCaption(item.captionEn),
    });
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

function normalizeDownloads(value) {
  return (Array.isArray(value) ? value : [])
    .map((item) => {
      if (!item) return null;
      if (typeof item === "string") {
        const parts = item.split("|").map((part) => part.trim());
        return { name: parts[0] || "", file: parts[1] || "", format: parts[2] || "" };
      }
      if (Array.isArray(item)) {
        return {
          name: String(item[0] || "").trim(),
          file: String(item[1] || "").trim(),
          format: String(item[2] || "").trim(),
        };
      }
      return {
        name: String(item.name || "").trim(),
        file: String(item.file || item.url || "").trim(),
        format: String(item.format || "").trim(),
      };
    })
    .filter((item) => item && (item.name || item.file));
}

function cleanEn(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const text = (value) => String(value || "").trim();
  const lines = (value) =>
    (Array.isArray(value) ? value : [])
      .map((item) => (Array.isArray(item) ? item.map((part) => text(part)) : text(item)))
      .filter((item) => (Array.isArray(item) ? item.some(Boolean) : item));
  const images = (Array.isArray(raw.images) ? raw.images : [])
    .map((item) => {
      if (!item || !item.url) return null;
      return { url: String(item.url).trim(), caption: clipCaption(item.caption) };
    })
    .filter(Boolean)
    .slice(0, MAX_GALLERY);
  const en = {
    name: text(raw.name),
    desc: text(raw.desc),
    tag: text(raw.tag),
    category: text(raw.category),
    intro: text(raw.intro),
    img: text(raw.img),
    imgCaption: clipCaption(raw.imgCaption),
    features: lines(raw.features),
    package: lines(raw.package),
    specs: lines(raw.specs),
    pins: lines(raw.pins),
    downloads: normalizeDownloads(raw.downloads),
    images,
  };
  Object.keys(en).forEach((key) => {
    const value = en[key];
    if (value == null || value === "" || (Array.isArray(value) && !value.length)) delete en[key];
  });
  return Object.keys(en).length ? en : undefined;
}

function categoryName(id, categories) {
  const list = Array.isArray(categories) && categories.length ? categories : DEFAULT_CATEGORIES;
  const found = list.find((c) => c.id === id);
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
    imgCaption: clipCaption(input.imgCaption),
    intro: String(input.intro || input.desc || name).trim(),
    features: features.length ? features : ["详情请见商品页"],
    specs: Array.isArray(input.specs) ? input.specs : [],
    pins: Array.isArray(input.pins) ? input.pins : [],
    package: packageList.length ? packageList : ["商品本体 ×1"],
    downloads: normalizeDownloads(input.downloads),
    en: cleanEn(input.en),
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
    const saved = await blobPutFile(blobPath, buffer, contentType);
    if (!saved) {
      const err = new Error("数据未能保存到服务器，请重试");
      err.code = "BLOB_MISSING";
      throw err;
    }
  } else if (isHosted()) {
    const err = new Error("数据未能保存到服务器，请重试");
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
  catalogCategories,
  readCatalog,
  writeCatalog,
  readCustomProducts,
  writeCustomProducts,
  setProductsHidden,
  deleteProducts,
  addCategory,
  removeCategory,
  normalizeProduct,
  nextProductId,
  categoryName,
  saveProductImage,
  readProductImage,
  addGalleryImages,
  updateGalleryCaption,
  removeGalleryImage,
  setGalleryImages,
  attachGalleries,
  listVisibleProducts,
  loadSeedProducts,
  MAX_GALLERY,
};
