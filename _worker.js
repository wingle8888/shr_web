import { createRequire } from "node:module";
import { runNodeHandler } from "./functions/_adapter.js";

const require = createRequire(import.meta.url);
const { setRuntimeEnv } = require("./api/_lib/runtime-env.js");
const products = require("./api/products.js");
const orders = require("./api/orders.js");
const downloads = require("./api/downloads.js");
const adminProducts = require("./api/admin/products.js");
const adminOrders = require("./api/admin/orders.js");
const adminUsers = require("./api/admin/users.js");
const adminFiles = require("./api/admin/files.js");
const adminUpload = require("./api/admin/upload.js");
const authMe = require("./api/auth/me.js");
const authRegister = require("./api/auth/register.js");
const authLogin = require("./api/auth/login.js");

const HANDLERS = {
  "/api/products": products,
  "/api/orders": orders,
  "/api/downloads": downloads,
  "/api/admin/products": adminProducts,
  "/api/admin/orders": adminOrders,
  "/api/admin/users": adminUsers,
  "/api/admin/files": adminFiles,
  "/api/admin/upload": adminUpload,
  "/api/auth/me": authMe,
  "/api/auth/register": authRegister,
  "/api/auth/login": authLogin,
};

function normalizePath(pathname) {
  const path = String(pathname || "/").replace(/\/+$/, "");
  return path || "/";
}

export default {
  async fetch(request, env, ctx) {
    try {
      setRuntimeEnv(env || {});
      const url = new URL(request.url);
      const path = normalizePath(url.pathname);

      if (path === "/api/health") {
        return new Response(JSON.stringify({ ok: true, runtime: "cloudflare" }), {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      }

      const handler = HANDLERS[path];
      if (handler) {
        return runNodeHandler({ request, env, ctx, params: {} }, handler);
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
