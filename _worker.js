import { runNodeHandler } from "./functions/_adapter.js";
import runtimeEnv from "./api/_lib/runtime-env.js";
import products from "./api/products.js";
import orders from "./api/orders.js";
import downloads from "./api/downloads.js";
import adminProducts from "./api/admin/products.js";
import adminOrders from "./api/admin/orders.js";
import adminUsers from "./api/admin/users.js";
import adminFiles from "./api/admin/files.js";
import adminUpload from "./api/admin/upload.js";
import authMe from "./api/auth/me.js";
import authRegister from "./api/auth/register.js";
import authLogin from "./api/auth/login.js";

const { setRuntimeEnv, getR2, getKV, isCloudflare } = runtimeEnv;

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
        return new Response(
          JSON.stringify({
            ok: true,
            runtime: "cloudflare",
            cloudflare: isCloudflare(),
            r2: Boolean(getR2()),
            kv: Boolean(getKV()),
            storeRev: 5,
          }),
          {
            status: 200,
            headers: { "content-type": "application/json; charset=utf-8" },
          }
        );
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
