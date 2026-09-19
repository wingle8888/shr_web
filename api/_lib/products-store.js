const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(process.cwd(), "data", "products-custom.json");
const TMP_FILE = path.join("/tmp", "shr-products-custom.json");

const CATEGORIES = [
  { id: "cat-mcu", name: "MCU 开发板" },
  { id: "cat-iot", name: "无线 IoT" },
  { id: "cat-sbc", name: "单板计算机" },
  { id: "cat-display", name: "显示套件" },
  { id: "cat-sensor", name: "传感器" },
];

function readCustomProducts() {
  try {
    if (fs.existsSync(TMP_FILE)) return JSON.parse(fs.readFileSync(TMP_FILE, "utf8"));
  } catch (_) {}
  try {
    if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch (_) {}
  return [];
}

function writeCustomProducts(list) {
  const products = Array.isArray(list) ? list : [];
  const text = JSON.stringify(products, null, 2);
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, text);
  } catch (_) {}
  try {
    fs.writeFileSync(TMP_FILE, text);
  } catch (_) {}
  return products;
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

module.exports = {
  CATEGORIES,
  readCustomProducts,
  writeCustomProducts,
  normalizeProduct,
  nextProductId,
  categoryName,
};
