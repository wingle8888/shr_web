const fs = require("fs");
const path = require("path");
const { readJsonStore, writeJsonStore, hasBlob } = require("./blob-store");
const { getCatalogStub } = require("./runtime-env");
const { normalizeCountryCode, countryName, compactPlace } = require("./geo");

const DATA_FILE = path.join(process.cwd(), "data", "visits.json");
const TMP_FILE = path.join("/tmp", "shr-visits.json");
const BLOB_PATH = "shr-visits/visits-db.json";
const MAX_UV_IDS = 3000;
const MAX_DAYS = 400;
const TZ = "Asia/Shanghai";

let memCache = null;

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
  return { days: {}, geoDeletedKeys: [], geoResetAt: "" };
}

function asGeoKeys(raw) {
  if (raw && Array.isArray(raw.geoDeletedKeys)) {
    return raw.geoDeletedKeys.map((id) => String(id || "").trim()).filter(Boolean);
  }
  return [];
}

function laterStamp(a, b) {
  const x = String(a || "");
  const y = String(b || "");
  return x >= y ? x : y;
}

function normalizeStore(raw) {
  if (!raw || typeof raw !== "object") return emptyStore();
  const days = raw.days && typeof raw.days === "object" ? raw.days : {};
  return {
    days,
    geoDeletedKeys: [...new Set(asGeoKeys(raw))].slice(-500),
    geoResetAt: String(raw.geoResetAt || ""),
  };
}

function applyGeoReset(days, resetAt) {
  const cutoff = String(resetAt || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cutoff) || !days || typeof days !== "object") return days;
  Object.keys(days).forEach((day) => {
    if (String(day) >= cutoff) return;
    const row = days[day];
    if (!row || typeof row !== "object") return;
    row.countries = {};
    row.places = {};
  });
  return days;
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
      countries: mergeCountryDay(ra.countries, rb.countries),
      places: mergePlaceDay(ra.places, rb.places),
    };
  });
  const geoResetAt = laterStamp(left.geoResetAt, right.geoResetAt);
  applyGeoReset(days, geoResetAt);
  return {
    days,
    geoDeletedKeys: [...new Set([...asGeoKeys(left), ...asGeoKeys(right)])].slice(-500),
    geoResetAt,
  };
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

async function readVisits() {
  const data = normalizeStore(
    await readJsonStore({
      blobPath: BLOB_PATH,
      localPaths: [TMP_FILE, DATA_FILE],
      empty: memCache ? normalizeStore(memCache) : emptyStore(),
      merge: mergeVisits,
    })
  );
  memCache = data;
  return data;
}

async function writeVisits(data) {
  const payload = pruneDays(data);
  writeVisitsLocal(payload);
  await writeJsonStore({
    blobPath: BLOB_PATH,
    localPaths: [TMP_FILE, DATA_FILE],
    data: payload,
  });
  memCache = payload;
  return payload;
}

function mergeCountryDay(a, b) {
  const out = {};
  const keys = new Set([...Object.keys(a && typeof a === "object" ? a : {}), ...Object.keys(b && typeof b === "object" ? b : {})]);
  keys.forEach((code) => {
    const ra = (a && a[code]) || {};
    const rb = (b && b[code]) || {};
    const uvSet = new Set([
      ...(Array.isArray(ra.uvIds) ? ra.uvIds : []),
      ...(Array.isArray(rb.uvIds) ? rb.uvIds : []),
    ]);
    out[code] = {
      pv: Math.max(Number(ra.pv) || 0, Number(rb.pv) || 0),
      uvIds: Array.from(uvSet).slice(-MAX_UV_IDS),
    };
  });
  return out;
}

function mergePlaceDay(a, b) {
  const out = {};
  const keys = new Set([
    ...Object.keys(a && typeof a === "object" ? a : {}),
    ...Object.keys(b && typeof b === "object" ? b : {}),
  ]);
  keys.forEach((key) => {
    const ra = (a && a[key]) || {};
    const rb = (b && b[key]) || {};
    const uvSet = new Set([
      ...(Array.isArray(ra.uvIds) ? ra.uvIds : []),
      ...(Array.isArray(rb.uvIds) ? rb.uvIds : []),
    ]);
    const compact = compactPlace({ ...ra, ...rb, countryCode: rb.countryCode || ra.countryCode || key.split("|")[0] });
    out[key] = {
      pv: Math.max(Number(ra.pv) || 0, Number(rb.pv) || 0),
      uvIds: Array.from(uvSet).slice(-MAX_UV_IDS),
      countryCode: compact.countryCode,
      country: compact.country || rb.country || ra.country || "",
      region: compact.region || rb.region || ra.region || "",
      city: compact.city || rb.city || ra.city || "",
      postalCode: compact.postalCode || rb.postalCode || ra.postalCode || "",
      label: compact.label || rb.label || ra.label || "",
    };
  });
  return out;
}

function bumpCountry(row, countryCode, visitorId) {
  const code = normalizeCountryCode(countryCode);
  if (!code || !row) return;
  if (!row.countries || typeof row.countries !== "object") row.countries = {};
  const prev = row.countries[code] && typeof row.countries[code] === "object" ? row.countries[code] : { pv: 0, uvIds: [] };
  prev.pv = (Number(prev.pv) || 0) + 1;
  if (!Array.isArray(prev.uvIds)) prev.uvIds = [];
  const vid = String(visitorId || "").slice(0, 64);
  if (vid && !prev.uvIds.includes(vid)) {
    prev.uvIds.push(vid);
    if (prev.uvIds.length > MAX_UV_IDS) prev.uvIds = prev.uvIds.slice(-MAX_UV_IDS);
  }
  row.countries[code] = prev;
}

const MAX_PLACES = 400;

function bumpPlace(row, place, visitorId) {
  const compact = compactPlace(place);
  if (!compact.countryCode || compact.countryCode === "UN") return;
  if (!compact.region && !compact.city && !compact.postalCode) return;
  if (!row.places || typeof row.places !== "object") row.places = {};
  const key = compact.key;
  if (!row.places[key] && Object.keys(row.places).length >= MAX_PLACES) return;
  const prev =
    row.places[key] && typeof row.places[key] === "object"
      ? row.places[key]
      : { pv: 0, uvIds: [], countryCode: compact.countryCode, country: compact.country, region: compact.region, city: compact.city, postalCode: compact.postalCode, label: compact.label };
  prev.pv = (Number(prev.pv) || 0) + 1;
  if (!Array.isArray(prev.uvIds)) prev.uvIds = [];
  const vid = String(visitorId || "").slice(0, 64);
  if (vid && !prev.uvIds.includes(vid)) {
    prev.uvIds.push(vid);
    if (prev.uvIds.length > MAX_UV_IDS) prev.uvIds = prev.uvIds.slice(-MAX_UV_IDS);
  }
  prev.countryCode = compact.countryCode;
  prev.country = compact.country || prev.country;
  prev.region = compact.region || prev.region;
  prev.city = compact.city || prev.city;
  prev.postalCode = compact.postalCode || prev.postalCode;
  prev.label = compact.label || prev.label;
  row.places[key] = prev;
}

function extractVisitCountries(daysMap, resetAt) {
  const cutoff = String(resetAt || "").slice(0, 10);
  const by = {};
  Object.entries(daysMap || {}).forEach(([day, row]) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(cutoff) && String(day) < cutoff) return;
    const cmap = row && row.countries;
    if (!cmap || typeof cmap !== "object") return;
    Object.keys(cmap).forEach((rawCode) => {
      const code = normalizeCountryCode(rawCode);
      if (!code) return;
      const item = cmap[rawCode] || {};
      if (!by[code]) by[code] = { code, name: countryName(code) || code, pv: 0, uvSet: new Set() };
      by[code].pv += Number(item.pv) || 0;
      (Array.isArray(item.uvIds) ? item.uvIds : []).forEach((id) => {
        if (id) by[code].uvSet.add(String(id));
      });
    });
  });
  return Object.values(by)
    .map((row) => ({ code: row.code, name: row.name, pv: row.pv, uv: row.uvSet.size }))
    .sort((a, b) => b.pv - a.pv);
}

function extractVisitPlaces(daysMap, resetAt) {
  const cutoff = String(resetAt || "").slice(0, 10);
  const by = {};
  Object.entries(daysMap || {}).forEach(([day, row]) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(cutoff) && String(day) < cutoff) return;
    const pmap = row && row.places;
    if (!pmap || typeof pmap !== "object") return;
    Object.keys(pmap).forEach((key) => {
      const item = pmap[key] || {};
      const compact = compactPlace({ ...item, countryCode: item.countryCode || String(key).split("|")[0] });
      if (!compact.countryCode || compact.countryCode === "UN") return;
      if (!by[compact.key]) {
        by[compact.key] = {
          key: compact.key,
          code: compact.countryCode,
          country: compact.country,
          name: compact.country,
          region: compact.region,
          city: compact.city,
          postalCode: compact.postalCode,
          label: compact.label,
          pv: 0,
          uvSet: new Set(),
        };
      }
      by[compact.key].pv += Number(item.pv) || 0;
      (Array.isArray(item.uvIds) ? item.uvIds : []).forEach((id) => {
        if (id) by[compact.key].uvSet.add(String(id));
      });
    });
  });
  return Object.values(by)
    .map((row) => ({
      key: row.key,
      code: row.code,
      country: row.country,
      name: row.name,
      region: row.region,
      city: row.city,
      postalCode: row.postalCode,
      label: row.label,
      pv: row.pv,
      uv: row.uvSet.size,
    }))
    .sort((a, b) => b.pv - a.pv);
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

function lastNMonthKeys(n) {
  const today = dayKey();
  const [y, m] = today.split("-").map(Number);
  const keys = [];
  for (let i = n - 1; i >= 0; i--) {
    keys.push(dayKey(new Date(Date.UTC(y, m - 1 - i, 15, 12))).slice(0, 7));
  }
  return keys;
}

function applyVisitRecord(data, { visitorId, pathName, referrer, day, countryCode, place } = {}) {
  const payload = normalizeStore(data);
  if (!payload.days) payload.days = {};
  const key = /^\d{4}-\d{2}-\d{2}$/.test(String(day || "")) ? String(day) : dayKey();
  const row = payload.days[key] || { pv: 0, uvIds: [], paths: {}, countries: {}, places: {} };
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
  const resolved = compactPlace(place || { countryCode });
  bumpCountry(row, resolved.countryCode || countryCode, vid);
  bumpPlace(row, resolved, vid);

  payload.days[key] = row;
  const pruned = pruneDays(payload);
  return { data: pruned, day: key, pv: row.pv, uv: row.uvIds.length };
}

async function recordVisitAtomic(payload) {
  const stub = getCatalogStub();
  if (!stub) return null;
  try {
    const res = await stub.fetch(
      new Request("https://catalog/do?path=" + encodeURIComponent(BLOB_PATH) + "&op=visit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      })
    );
    if (!res || !res.ok) return null;
    const result = await res.json().catch(() => ({}));
    if (!result || result.ok === false) return null;
    memCache = null;
    return result;
  } catch (_) {
    return null;
  }
}

async function recordVisit({ visitorId, pathName, referrer, countryCode, place } = {}) {
  const day = dayKey();
  const atomic = await recordVisitAtomic({ visitorId, pathName, referrer, day, countryCode, place });
  if (atomic && atomic.day) {
    return {
      day: atomic.day,
      pv: Number(atomic.pv) || 0,
      uv: Number(atomic.uv) || 0,
      storage: hasBlob() ? "blob" : "local",
    };
  }

  const applied = applyVisitRecord(await readVisits(), { visitorId, pathName, referrer, day, countryCode, place });
  await writeVisits(applied.data);
  return {
    day: applied.day,
    pv: applied.pv,
    uv: applied.uv,
    storage: hasBlob() ? "blob" : "local",
  };
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
      const uvIds = Array.isArray(row.uvIds) ? row.uvIds.map(String).filter(Boolean) : [];
      return {
        day,
        pv: Number(row.pv) || 0,
        uv: uvIds.length,
        uvIds,
      };
    });

  const byKey = new Map(dailyAll.map((d) => [d.day, d]));
  const daily = lastNDayKeys(30).map((day) => {
    const row = byKey.get(day);
    return row ? { day: row.day, pv: row.pv, uv: row.uv } : { day, pv: 0, uv: 0 };
  });

  const byMonth = {};
  dailyAll.forEach((d) => {
    const m = monthKeyFromDay(d.day);
    if (!byMonth[m]) byMonth[m] = { month: m, pv: 0, uvSet: new Set(), days: 0 };
    byMonth[m].pv += d.pv;
    (d.uvIds || []).forEach((id) => byMonth[m].uvSet.add(id));
    byMonth[m].days += 1;
  });
  const monthlyAll = Object.values(byMonth)
    .map((m) => ({ month: m.month, pv: m.pv, uv: m.uvSet.size, days: m.days }))
    .sort((a, b) => String(a.month).localeCompare(String(b.month)));
  const monthMap = new Map(monthlyAll.map((m) => [m.month, m]));
  const monthly = lastNMonthKeys(12).map((month) => monthMap.get(month) || { month, pv: 0, uv: 0, days: 0 });

  const todayRow = byKey.get(today) || { day: today, pv: 0, uv: 0 };
  const monthRow = monthMap.get(thisMonth) || { month: thisMonth, pv: 0, uv: 0, days: 0 };
  const allUv = new Set();
  dailyAll.forEach((d) => (d.uvIds || []).forEach((id) => allUv.add(id)));

  return {
    today: { day: todayRow.day, pv: todayRow.pv, uv: todayRow.uv },
    thisMonth: monthRow,
    daily,
    monthly,
    totalPv: dailyAll.reduce((s, d) => s + d.pv, 0),
    totalUv: allUv.size,
    timezone: TZ,
    updatedAt: new Date().toISOString(),
    storage: hasBlob() ? "blob" : "local",
    countries: extractVisitCountries(daysMap, data.geoResetAt),
    places: extractVisitPlaces(daysMap, data.geoResetAt),
    geoDeletedKeys: data.geoDeletedKeys || [],
    geoResetAt: data.geoResetAt || "",
  };
}

async function loadVisitStats() {
  const data = await readVisits();
  return buildVisitStats(data);
}

function normalizeGeoKeys(ids) {
  const list = Array.isArray(ids) ? ids : ids != null ? [ids] : [];
  return [...new Set(list.map((id) => String(id || "").trim()).filter(Boolean))];
}

async function deleteGeoKeys(ids) {
  const remove = normalizeGeoKeys(ids);
  const current = await readVisits();
  if (!remove.length) return current;
  current.geoDeletedKeys = [...new Set([...(current.geoDeletedKeys || []), ...remove])].slice(-500);
  return writeVisits(current);
}

async function clearGeoStats() {
  const current = await readVisits();
  current.geoDeletedKeys = [];
  current.geoResetAt = new Date().toISOString();
  applyGeoReset(current.days, current.geoResetAt);
  Object.keys(current.days || {}).forEach((day) => {
    const row = current.days[day];
    if (!row || typeof row !== "object") return;
    row.countries = {};
    row.places = {};
  });
  return writeVisits(current);
}

module.exports = {
  readVisits,
  writeVisits,
  recordVisit,
  applyVisitRecord,
  buildVisitStats,
  loadVisitStats,
  deleteGeoKeys,
  clearGeoStats,
  dayKey,
};
