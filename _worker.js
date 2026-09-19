import { createRequire } from "node:module";
import { runNodeHandler } from "./functions/_adapter.js";

const require = createRequire(import.meta.url);

const HANDLERS = {
  "/api/products": () => require("./api/products.js"),
  "/api/orders": () => require("./api/orders.js"),
  "/api/downloads": () => require("./api/downloads.js"),
  "/api/admin/products": () => require("./api/admin/products.js"),
  "/api/admin/orders": () => require("./api/admin/orders.js"),
  "/api/admin/users": () => require("./api/admin/users.js"),
  "/api/admin/files": () => require("./api/admin/files.js"),
  "/api/admin/upload": () => require("./api/admin/upload.js"),
  "/api/auth/me": () => require("./api/auth/me.js"),
  "/api/auth/register": () => require("./api/auth/register.js"),
  "/api/auth/login": () => require("./api/auth/login.js"),
};

function normalizePath(pathname) {
  const path = String(pathname || "/").replace(/\/+$/, "");
  return path || "/";
}

export default {
  async fetch(request, env, ctx) {
    try {
      const { setRuntimeEnv } = require("./api/_lib/runtime-env.js");
      setRuntimeEnv(env || {});
      const url = new URL(request.url);
      const path = normalizePath(url.pathname);

      if (path === "/api/health") {
        return new Response(JSON.stringify({ ok: true, runtime: "cloudflare" }), {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      }

      const load = HANDLERS[path];
      if (load) {
        return runNodeHandler({ request, env, ctx, params: {} }, load());
      }

      if (env && env.ASSETS) {
        return env.ASSETS.fetch(request);
      }
      return new Response("Not found", { status: 404 });
    } catch (err) {
      return new Response(JSON.stringify({ ok: false, error: String((err && err.message) || err) }), {
        status: 500,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }
  },
};
