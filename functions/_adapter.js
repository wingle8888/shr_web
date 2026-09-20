import { createRequire } from "node:module";
import runtimeEnv from "../api/_lib/runtime-env.js";

const require = createRequire(import.meta.url);
const { applySecurityHeaders } = require("../api/_lib/security-headers.js");

const { setRuntimeEnv } = runtimeEnv;

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

export async function runNodeHandler(context, handler) {
  try {
    return await invokeHandler(context, handler);
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String((err && err.message) || err) }), {
      status: 500,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
}

async function invokeHandler(context, handler) {
  setRuntimeEnv(context.env || {});
  const request = context.request;
  const url = new URL(request.url);
  const req = {
    method: request.method,
    url: `${url.pathname}${url.search}`,
    headers: headerMap(request),
    body: await parseRequestBody(request),
    cf: request.cf || null,
  };
  const box = createNodeRes();
  await handler(req, box.res);
  if (!box.res.statusCode) await box.done;
  const out = box.result();
  const headers = new Headers(out.headers);
  if (!headers.has("access-control-allow-origin")) {
    headers.set("access-control-allow-origin", "*");
  }
  applySecurityHeaders(headers);
  return new Response(out.body, { status: out.statusCode, headers });
}
