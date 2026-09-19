import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { setRuntimeEnv } = require("../../api/_lib/runtime-env.js");

const HANDLERS = {
  products: require("../../api/products.js"),
  orders: require("../../api/orders.js"),
  downloads: require("../../api/downloads.js"),
  "admin/products": require("../../api/admin/products.js"),
  "admin/orders": require("../../api/admin/orders.js"),
  "admin/users": require("../../api/admin/users.js"),
  "admin/files": require("../../api/admin/files.js"),
  "admin/upload": require("../../api/admin/upload.js"),
  "auth/me": require("../../api/auth/me.js"),
  "auth/register": require("../../api/auth/register.js"),
  "auth/login": require("../../api/auth/login.js"),
};

function routeKey(params) {
  const raw = params && params.path;
  if (Array.isArray(raw)) return raw.filter(Boolean).join("/");
  return String(raw || "")
    .split("/")
    .filter(Boolean)
    .join("/");
}

function headerMap(request) {
  const headers = {};
  request.headers.forEach((value, key) => {
    headers[String(key).toLowerCase()] = value;
  });
  return headers;
}

async function parseRequestBody(request) {
  const method = request.method || "GET";
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return {};
  const text = await request.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (_) {
    return { raw: text };
  }
}

function createNodeRes() {
  let statusCode = 200;
  const headers = {};
  const chunks = [];
  let ended = false;
  let resolveDone;
  const done = new Promise((resolve) => {
    resolveDone = resolve;
  });
  const res = {
    get statusCode() {
      return statusCode;
    },
    set statusCode(value) {
      statusCode = Number(value) || 200;
    },
    setHeader(key, value) {
      headers[String(key).toLowerCase()] = String(value);
    },
    getHeader(key) {
      return headers[String(key).toLowerCase()];
    },
    end(chunk) {
      if (ended) return;
      ended = true;
      if (chunk != null) chunks.push(chunk);
      resolveDone();
    },
  };
  return {
    res,
    done,
    result() {
      let body = "";
      if (chunks.length === 1) body = chunks[0];
      else if (chunks.length > 1) {
        body = Buffer.concat(chunks.map((c) => (Buffer.isBuffer(c) ? c : Buffer.from(String(c)))));
      }
      return { statusCode, headers, body };
    },
  };
}

export async function onRequest(context) {
  setRuntimeEnv(context.env || {});
  const key = routeKey(context.params);
  const handler = HANDLERS[key];
  if (!handler) {
    return new Response(JSON.stringify({ ok: false, error: "not found" }), {
      status: 404,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  const request = context.request;
  const url = new URL(request.url);
  const body = await parseRequestBody(request);
  const req = {
    method: request.method,
    url: `${url.pathname}${url.search}`,
    headers: headerMap(request),
    body,
  };
  const box = createNodeRes();
  await handler(req, box.res);
  await Promise.race([
    box.done,
    new Promise((resolve) => setTimeout(resolve, 50)),
  ]);
  const out = box.result();
  const headers = new Headers(out.headers);
  if (!headers.has("access-control-allow-origin")) {
    headers.set("access-control-allow-origin", "*");
  }
  return new Response(out.body, { status: out.statusCode, headers });
}
