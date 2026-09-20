const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "dist-assets");
const FILES = ["index.html", "product.html", "chat.html", "favicon.ico", "_headers"];
const DIRS = ["css", "js", "images", "admin", "client", "downloads"];
const BUILD_MARK = "worker-fix=v11";

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  fs.readdirSync(src).forEach((name) => {
    const from = path.join(src, name);
    const to = path.join(dest, name);
    if (fs.statSync(from).isDirectory()) copyDir(from, to);
    else copyFile(from, to);
  });
}

function walkJs(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  fs.readdirSync(dir).forEach((name) => {
    const from = path.join(dir, name);
    if (fs.statSync(from).isDirectory()) walkJs(from, out);
    else if (name.endsWith(".js")) out.push(from);
  });
  return out;
}

function stripCreateRequire(file) {
  const original = fs.readFileSync(file, "utf8");
  if (!original.includes("createRequire")) return false;
  const next = original
    .replace(/import\s*\{\s*createRequire\s*\}\s*from\s*["']node:module["'];\r?\n/g, "")
    .replace(
      /const require = createRequire\(import\.meta\.url\);\r?\nconst handler = require\(([^)]+)\);/g,
      "import handler from $1;"
    )
    .replace(
      /const require = createRequire\(import\.meta\.url\);\r?\nconst \{ applySecurityHeaders \} = require\(([^)]+)\);/g,
      "import { applySecurityHeaders } from $1;"
    )
    .replace(/createRequire\(import\.meta\.url\)/g, 'createRequire(import.meta.url || "file:///")');
  if (next !== original) {
    fs.writeFileSync(file, next);
    return true;
  }
  return false;
}

function dedupeCityMap(file) {
  if (!fs.existsSync(file)) return false;
  const original = fs.readFileSync(file, "utf8");
  const match = original.match(/const CN_CITY_ZH = \{[\s\S]*?\n\};/);
  if (!match) return false;
  const seen = new Set();
  const rewritten = match[0]
    .split("\n")
    .filter((line) => {
      const keyMatch = line.match(/^\s*([A-Za-z0-9_]+|"[^"]+"|'[^']+')\s*:/);
      if (!keyMatch) return true;
      const key = keyMatch[1].replace(/['"]/g, "");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join("\n");
  if (rewritten === match[0]) return false;
  fs.writeFileSync(file, original.replace(match[0], rewritten));
  return true;
}

const adapterPath = path.join(ROOT, "functions", "_adapter.js");
const geoPath = path.join(ROOT, "api", "_lib", "geo.js");
const patched = [];
walkJs(path.join(ROOT, "functions")).forEach((file) => {
  if (stripCreateRequire(file)) patched.push(path.relative(ROOT, file));
});
if (dedupeCityMap(geoPath)) patched.push("api/_lib/geo.js");

const adapterText = fs.existsSync(adapterPath) ? fs.readFileSync(adapterPath, "utf8") : "";
const geoText = fs.existsSync(geoPath) ? fs.readFileSync(geoPath, "utf8") : "";
console.log("[custom build]", BUILD_MARK);
console.log(
  "[custom build] commit=",
  process.env.CF_PAGES_COMMIT_SHA || process.env.WORKERS_CI_COMMIT_SHA || "local"
);
console.log("[custom build] patched=", patched.join(",") || "none");
console.log("[custom build] adapterHasCreateRequire=", adapterText.includes("createRequire"));
console.log("[custom build] geoObjectLiteral=", /const CN_CITY_ZH = \{/.test(geoText));

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
FILES.forEach((file) => {
  const src = path.join(ROOT, file);
  if (fs.existsSync(src)) copyFile(src, path.join(OUT, file));
});
DIRS.forEach((dir) => copyDir(path.join(ROOT, dir), path.join(OUT, dir)));
console.log("[custom build] cloudflare assets ready:", OUT, BUILD_MARK);
