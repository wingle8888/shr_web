const path = require("path");
const { readJsonStore, writeJsonStore } = require("./blob-store");
const { readRegisterPlace, formatRegisterPlace } = require("./geo");

const BLOB_PATH = "shr-admin/login-history.json";
const TMP_FILE = path.join("/tmp", "shr-login-history.json");
const MAX_LOGINS = 300;

function emptyStore() {
  return { logins: [] };
}

function asList(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.logins)) return raw.logins;
  return [];
}

function mergeHistory(a, b) {
  const map = new Map();
  [...asList(a), ...asList(b)].forEach((row) => {
    if (!row || !row.id) return;
    const key = String(row.id);
    const prev = map.get(key);
    if (!prev) {
      map.set(key, row);
      return;
    }
    const prevT = String(prev.at || "");
    const nextT = String(row.at || "");
    map.set(key, nextT >= prevT ? { ...prev, ...row } : { ...row, ...prev });
  });
  return {
    logins: Array.from(map.values())
      .sort((x, y) => String(y.at || "").localeCompare(String(x.at || "")))
      .slice(0, MAX_LOGINS),
  };
}

async function readLoginHistory() {
  const data = await readJsonStore({
    blobPath: BLOB_PATH,
    localPaths: [TMP_FILE],
    empty: emptyStore(),
    merge: mergeHistory,
  });
  return mergeHistory(emptyStore(), data);
}

async function writeLoginHistory(data) {
  const payload = mergeHistory(emptyStore(), data);
  await writeJsonStore({
    blobPath: BLOB_PATH,
    localPaths: [TMP_FILE],
    data: payload,
  });
  return payload;
}

function clean(value, max = 120) {
  return String(value || "").trim().slice(0, max);
}

function readClientIp(req) {
  const headers = (req && req.headers) || {};
  const cf = clean(headers["cf-connecting-ip"] || headers["true-client-ip"], 64);
  const xff = clean(String(headers["x-forwarded-for"] || "").split(",")[0], 64);
  return cf || xff || clean(headers["x-real-ip"], 64);
}

function parseUserAgent(ua) {
  const s = String(ua || "");
  let os = "未知系统";
  const android = s.match(/Android\s([\d.]+)/i);
  const ios = s.match(/OS\s([\d_]+)\s+like Mac OS X/i);
  if (/Windows NT 10/i.test(s)) os = "Windows 10/11";
  else if (/Windows NT 6\.3/i.test(s)) os = "Windows 8.1";
  else if (/Windows NT 6\.1/i.test(s)) os = "Windows 7";
  else if (/Windows/i.test(s)) os = "Windows";
  else if (android) os = "Android " + android[1];
  else if (ios) os = "iOS " + ios[1].replace(/_/g, ".");
  else if (/Mac OS X/i.test(s)) os = "macOS";
  else if (/Linux/i.test(s)) os = "Linux";

  const webview = /; wv\)/i.test(s) || /\bwv\b/i.test(s);
  let browser = "未知浏览器";
  if (webview) browser = "系统 WebView";
  else if (/Edg\//i.test(s)) browser = "Microsoft Edge";
  else if (/Chrome\//i.test(s)) browser = "Chrome";
  else if (/Firefox\//i.test(s)) browser = "Firefox";
  else if (/Safari/i.test(s) && !/Chrome/i.test(s)) browser = "Safari";

  const device = /Mobile|Android|iPhone|iPad/i.test(s) ? "手机" : "电脑";
  return { os, browser, device, webview };
}

function resolveClientName(hint, parsed, ua) {
  const h = String(hint || "").toLowerCase();
  if (h === "android" || parsed.webview) return "Android 客户端";
  if (h === "windows" || h === "app") return "Windows 客户端";
  if (/Windows/i.test(ua) && /Edg\//i.test(ua) && h === "standalone") return "Windows 客户端";
  if (/Android/i.test(ua)) return "Android 浏览器";
  return "网页后台";
}

function buildLoginRecord(req, body) {
  const ua = clean((req && req.headers && (req.headers["user-agent"] || req.headers["User-Agent"])) || "", 300);
  const parsed = parseUserAgent(ua);
  const place = readRegisterPlace(req, body) || {};
  const address = formatRegisterPlace(place) || place.country || "";
  const ip = readClientIp(req);
  const client = resolveClientName(body && body.client, parsed, ua);
  return {
    id: "L" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    at: new Date().toISOString(),
    ip: ip || "",
    address: address || (ip ? "IP " + ip : "未知地址"),
    country: place.country || "",
    countryCode: place.countryCode || "",
    region: place.region || "",
    city: place.city || "",
    timezone: clean((place.timezone || (body && body.timezone) || ""), 80),
    os: parsed.os,
    system: parsed.os,
    browser: parsed.browser,
    device: parsed.device,
    client,
    reason: clean((body && body.reason) || "", 24) || "auto",
    language: clean((body && body.language) || "", 32),
    platform: clean((body && body.platform) || "", 64),
    screen: clean((body && body.screen) || "", 24),
    userAgent: ua,
  };
}

async function appendLogin(req, body) {
  const row = buildLoginRecord(req, body);
  const current = await readLoginHistory();
  const next = { logins: [row, ...asList(current)].slice(0, MAX_LOGINS) };
  await writeLoginHistory(next);
  return row;
}

module.exports = {
  readLoginHistory,
  appendLogin,
  asList,
  buildLoginRecord,
};
