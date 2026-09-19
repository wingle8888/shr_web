const { spawnSync } = require("child_process");
const path = require("path");

require("./cf-build.js");

const root = path.join(__dirname, "..");
spawnSync("npx", ["--yes", "wrangler", "r2", "bucket", "create", "develop-boards"], {
  cwd: root,
  stdio: "inherit",
  shell: true,
  env: process.env,
});
const result = spawnSync(
  "npx",
  ["--yes", "wrangler", "deploy", "--assets=./dist-assets"],
  {
    cwd: root,
    stdio: "inherit",
    shell: true,
    env: process.env,
  }
);

process.exit(result.status == null ? 1 : result.status);
