import { runNodeHandler } from "./functions/_adapter.js";
import runtimeEnv from "./api/_lib/runtime-env.js";
import products from "./api/products.js";
import orders from "./api/orders.js";
import downloads from "./api/downloads.js";
import chat from "./api/chat.js";
import adminProducts from "./api/admin/products.js";
import adminOrders from "./api/admin/orders.js";
import adminUsers from "./api/admin/users.js";
import adminFiles from "./api/admin/files.js";
import adminUpload from "./api/admin/upload.js";
import adminChat from "./api/admin/chat.js";
import adminAuth from "./api/admin/auth.js";
import visitsStore from "./api/_lib/visits-store.js";
import authMe from "./api/auth/me.js";
import authRegister from "./api/auth/register.js";
import authLogin from "./api/auth/login.js";
import authWarehouse from "./api/auth/warehouse.js";
import securityHeaders from "./api/_lib/security-headers.js";

const { setRuntimeEnv, getR2, getKV, getCatalogStub, isCloudflare } = runtimeEnv;
const withSecurityHeaders = securityHeaders.withSecurityHeaders || securityHeaders;

const HANDLERS = {
  "/api/products": products,
  "/api/orders": orders,
  "/api/downloads": downloads,
  "/api/admin/products": adminProducts,
  "/api/admin/orders": adminOrders,
  "/api/admin/users": adminUsers,
  "/api/admin/files": adminFiles,
  "/api/admin/upload": adminUpload,
  "/api/chat": chat,
  "/api/admin/chat": adminChat,
  "/api/admin/auth": adminAuth,
  "/api/auth/me": authMe,
  "/api/auth/register": authRegister,
  "/api/auth/login": authLogin,
  "/api/auth/warehouse": authWarehouse,
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
        return withSecurityHeaders(
          new Response(
            JSON.stringify({
              ok: true,
              runtime: "cloudflare",
              cloudflare: isCloudflare(),
              r2: Boolean(getR2()),
              kv: Boolean(getKV()),
              durable: Boolean(getCatalogStub()),
              storeRev: 10,
            }),
            {
              status: 200,
              headers: { "content-type": "application/json; charset=utf-8" },
            }
          )
        );
      }

      const handler = HANDLERS[path];
      if (handler) {
        return withSecurityHeaders(await runNodeHandler({ request, env, ctx, params: {} }, handler));
      }

      if (env && env.ASSETS) {
        return withSecurityHeaders(await env.ASSETS.fetch(request));
      }
      return withSecurityHeaders(new Response("Not found", { status: 404 }));
    } catch (err) {
      return withSecurityHeaders(
        new Response(JSON.stringify({ ok: false, error: String((err && err.message) || err) }), {
          status: 500,
          headers: { "content-type": "application/json; charset=utf-8" },
        })
      );
    }
  },
};

export class CatalogDO {
  constructor(state) {
    this.state = state;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const key = String(url.searchParams.get("path") || "catalog");
    const op = String(url.searchParams.get("op") || "");

    if (op === "visit" && (request.method === "POST" || request.method === "PUT")) {
      const body = await request.json().catch(() => ({}));
      let data = await this.state.storage.get(key);
      const applyVisit =
        (visitsStore && visitsStore.applyVisitRecord) ||
        (visitsStore && visitsStore.default && visitsStore.default.applyVisitRecord);
      const applied = applyVisit(data, body);
      await this.state.storage.put(key, applied.data);
      return new Response(JSON.stringify({ ok: true, day: applied.day, pv: applied.pv, uv: applied.uv }), {
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }

    if (request.method === "PUT" || request.method === "POST") {
      const text = await request.text();
      const data = text ? JSON.parse(text) : null;
      await this.state.storage.put(key, data);
      return new Response("ok");
    }
    const data = await this.state.storage.get(key);
    return new Response(JSON.stringify(data === undefined ? null : data), {
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
}
