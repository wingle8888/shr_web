const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(process.cwd(), "data", "visits.json");
const TMP_FILE = path.join("/tmp", "shr-visits.json");
const BLOB_PATH = "shr-visits/visits-db.json";
const MAX_UV_IDS = 3000;
const MAX_DAYS = 400;
const TZ = "Asia/Shanghai";

let memCache = null;

function blobToken() {
  return String(process.env.BLOB_READ_WRITE_TOKEN || "").trim();
}

function hasBlob() {
  if (blobToken()) return true;
  if (process.env.BLOB_STORE_ID && (process.env.VERCEL || process.env.VERCEL_OIDC_TOKEN)) return true;
  return false;
}

function blobAuthOpts() {
  const token = blobToken();
  return token ? { token } : {};
}

function dayKey(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function monthKeyFromDay(day) {
  return String(day || "").slice(0, 7);
}

function emptyStore() {
  return { days: {} };
}

function normalizeStore(raw) {
  if (!raw || typeof raw !== "object") return emptyStore();
  const days = raw.days && typeof raw.days === "object" ? raw.days : {};
  return { days };
}

function mergeVisits(a, b) {
  const left = normalizeStore(a);
  const right = normalizeStore(b);
  const days = {};
  const keys = new Set([...Object.keys(left.days), ...Object.keys(right.days)]);
  keys.forEach((key) => {
    const ra = left.days[key] || {};
    const rb = right.days[key] || {};
    const uvSet = new Set([...(Array.isArray(ra.uvIds) ? ra.uvIds : []), ...(Array.isArray(rb.uvIds) ? rb.uvIds : [])]);
    const paths = {};
    [ra.paths, rb.paths].forEach((map) => {
      if (!map || typeof map !== "object") return;
      Object.keys(map).forEach((p) => {
        paths[p] = Math.max(Number(paths[p]) || 0, Number(map[p]) || 0);
      });
    });
    days[key] = {
      pv: Math.max(Number(ra.pv) || 0, Number(rb.pv) || 0),
      uvIds: Array.from(uvSet).slice(-MAX_UV_IDS),
      paths,
      lastReferrer: rb.lastReferrer || ra.lastReferrer || "",
    };
  });
  return { days };
}

function pruneDays(data) {
  const payload = normalizeStore(data);
  const keys = Object.keys(payload.days).sort();
  if (keys.length > MAX_DAYS) {
    keys.slice(0, keys.length - MAX_DAYS).forEach((k) => delete payload.days[k]);
  }
  return payload;
}

function readVisitsLocal() {
  let local = emptyStore();
  try {
    if (fs.existsSync(TMP_FILE)) local = mergeVisits(local, JSON.parse(fs.readFileSync(TMP_FILE, "utf8")));
  } catch (_) {}
  try {
    if (fs.existsSync(DATA_FILE)) local = mergeVisits(local, JSON.parse(fs.readFileSync(DATA_FILE, "utf8")));
  } catch (_) {}
  return local;
}

function writeVisitsLocal(data) {
  const payload = pruneDays(data);
  const text = JSON.stringify(payload);
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, text);
  } catch (_) {}
  try {
    fs.writeFileSync(TMP_FILE, text);
  } catch (_) {}
  memCache = payload;
  return payload;
}

async function streamToText(stream) {
  if (!stream) return "";
  if (typeof stream === "string") return stream;
  if (Buffer.isBuffer(stream)) return stream.toString("utf8");
  if (typeof stream.text === "function") return stream.text();
  return new Response(stream).text();
}

async function readVisitsFromBlob() {
  if (!hasBlob()) return null;
  try {
    const { get } = require("@vercel/blob");
    const result = await get(BLOB_PATH, { access: "private", ...blobAuthOpts() });
    if (!result || result.statusCode !== 200) return emptyStore();
    const text = await streamToText(result.stream);
    if (!text) return emptyStore();
    return normalizeStore(JSON.parse(text));
  } catch (_) {
    return null;
  }
}

async function writeVisitsToBlob(data) {
  if (!hasBlob()) return false;
  const { put } = require("@vercel/blob");
  await put(BLOB_PATH, JSON.stringify(pruneDays(data)), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    ...blobAuthOpts(),
  });
  return true;
}

async function readVisits() {
  let data = memCache ? normalizeStore(memCache) : emptyStore();
  data = mergeVisits(data, readVisitsLocal());
  const fromBlob = await readVisitsFromBlob();
  if (fromBlob) data = mergeVisits(data, fromBlob);
  memCache = data;
  return data;
}

async function writeVisits(data) {
  const payload = writeVisitsLocal(data);
  if (hasBlob()) {
    try {
      await writeVisitsToBlob(payload);
    } catch (_) {}
  }
  return payload;
}

async function recordVisit({ visitorId, pathName, referrer } = {}) {
  const data = await readVisits();
  if (!data.days) data.days = {};
  const key = dayKey();
  const row = data.days[key] || { pv: 0, uvIds: [], paths: {} };
  row.pv = (Number(row.pv) || 0) + 1;

  const vid = String(visitorId || "").slice(0, 64);
  if (!Array.isArray(row.uvIds)) row.uvIds = [];
  if (vid && !row.uvIds.includes(vid)) {
    row.uvIds.push(vid);
    if (row.uvIds.length > MAX_UV_IDS) row.uvIds = row.uvIds.slice(-MAX_UV_IDS);
  }

  const p = String(pathName || "/").slice(0, 120) || "/";
  if (!row.paths || typeof row.paths !== "object") row.paths = {};
  row.paths[p] = (Number(row.paths[p]) || 0) + 1;
  if (referrer) row.lastReferrer = String(referrer).slice(0, 200);

  data.days[key] = row;
  await writeVisits(data);
  return {
    day: key,
    pv: row.pv,
    uv: row.uvIds.length,
    storage: hasBlob() ? "blob" : "local",
  };
}

function lastNDayKeys(n) {
  const today = dayKey();
  const [y, m, d] = today.split("-").map(Number);
  const keys = [];
  for (let i = n - 1; i >= 0; i--) {
    keys.push(dayKey(new Date(Date.UTC(y, m - 1, d - i, 12))));
  }
  return keys;
}

function buildVisitStats(raw) {
  const data = normalizeStore(raw);
  const daysMap = data.days || {};
  const today = dayKey();
  const thisMonth = today.slice(0, 7);

  const dailyAll = Object.keys(daysMap)
    .sort()
    .map((day) => {
      const row = daysMap[day] || {};
      return {
        day,
        pv: Number(row.pv) || 0,
        uv: Array.isArray(row.uvIds) ? row.uvIds.length : Number(row.uv) || 0,
      };
    });

  const byKey = new Map(dailyAll.map((d) => [d.day, d]));
  const daily = lastNDayKeys(30).map((day) => byKey.get(day) || { day, pv: 0, uv: 0 });

  const byMonth = {};
  dailyAll.forEach((d) => {
    const m = monthKeyFromDay(d.day);
    if (!byMonth[m]) byMonth[m] = { month: m, pv: 0, uv: 0, days: 0 };
    byMonth[m].pv += d.pv;
    byMonth[m].uv += d.uv;
    byMonth[m].days += 1;
  });
  const monthly = Object.values(byMonth).sort((a, b) => String(a.month).localeCompare(String(b.month)));

  const todayRow = byKey.get(today) || { day: today, pv: 0, uv: 0 };
  const monthRow = byMonth[thisMonth] || { month: thisMonth, pv: 0, uv: 0, days: 0 };

  return {
    today: todayRow,
    thisMonth: monthRow,
    daily,
    monthly: monthly.slice(-12),
    totalPv: dailyAll.reduce((s, d) => s + d.pv, 0),
    totalUv: dailyAll.reduce((s, d) => s + d.uv, 0),
    timezone: TZ,
    updatedAt: new Date().toISOString(),
    storage: hasBlob() ? "blob" : "local",
  };
}

async function loadVisitStats() {
  const data = await readVisits();
  return buildVisitStats(data);
}

module.exports = {
  readVisits,
  writeVisits,
  recordVisit,
  buildVisitStats,
  loadVisitStats,
  dayKey,
};
