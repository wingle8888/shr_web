const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "dist-assets");
const FILES = ["index.html", "product.html", "favicon.ico", "_headers"];
const DIRS = ["css", "js", "images", "admin", "client", "downloads"];

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

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
FILES.forEach((file) => {
  const src = path.join(ROOT, file);
  if (fs.existsSync(src)) copyFile(src, path.join(OUT, file));
});
DIRS.forEach((dir) => copyDir(path.join(ROOT, dir), path.join(OUT, dir)));
try {
  spawnSync("npx", ["--yes", "wrangler", "r2", "bucket", "create", "develop-boards"], {
    cwd: ROOT,
    stdio: "inherit",
    shell: true,
    env: process.env,
  });
} catch (_) {}
console.log("cloudflare assets ready:", OUT);
