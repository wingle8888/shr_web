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
import authMe from "./api/auth/me.js";
import authRegister from "./api/auth/register.js";
import authLogin from "./api/auth/login.js";

const { setRuntimeEnv, getR2, getKV, getCatalogStub, isCloudflare } = runtimeEnv;

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
            durable: Boolean(getCatalogStub()),
            storeRev: 8,
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
      if (!data || typeof data !== "object") data = { days: {} };
      if (!data.days || typeof data.days !== "object") data.days = {};
      const day = String(body.day || "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
        return new Response(JSON.stringify({ ok: false, error: "invalid day" }), {
          status: 400,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      }
      const row = data.days[day] && typeof data.days[day] === "object"
        ? data.days[day]
        : { pv: 0, uvIds: [], paths: {} };
      row.pv = (Number(row.pv) || 0) + 1;
      const vid = String(body.visitorId || "").slice(0, 64);
      if (!Array.isArray(row.uvIds)) row.uvIds = [];
      if (vid && !row.uvIds.includes(vid)) {
        row.uvIds.push(vid);
        if (row.uvIds.length > 3000) row.uvIds = row.uvIds.slice(-3000);
      }
      const p = String(body.pathName || "/").slice(0, 120) || "/";
      if (!row.paths || typeof row.paths !== "object") row.paths = {};
      row.paths[p] = (Number(row.paths[p]) || 0) + 1;
      if (body.referrer) row.lastReferrer = String(body.referrer).slice(0, 200);
      let cc = String(body.countryCode || "").toUpperCase().slice(0, 2);
      if (cc === "UK") cc = "GB";
      if (/^[A-Z]{2}$/.test(cc) && cc !== "XX" && cc !== "T1") {
        if (!row.countries || typeof row.countries !== "object") row.countries = {};
        const ctry = row.countries[cc] && typeof row.countries[cc] === "object" ? row.countries[cc] : { pv: 0, uvIds: [] };
        ctry.pv = (Number(ctry.pv) || 0) + 1;
        if (!Array.isArray(ctry.uvIds)) ctry.uvIds = [];
        if (vid && !ctry.uvIds.includes(vid)) {
          ctry.uvIds.push(vid);
          if (ctry.uvIds.length > 3000) ctry.uvIds = ctry.uvIds.slice(-3000);
        }
        row.countries[cc] = ctry;
      }
      data.days[day] = row;
      const keys = Object.keys(data.days).sort();
      if (keys.length > 400) {
        keys.slice(0, keys.length - 400).forEach((k) => delete data.days[k]);
      }
      await this.state.storage.put(key, data);
      return new Response(JSON.stringify({ ok: true, day, pv: row.pv, uv: row.uvIds.length }), {
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
