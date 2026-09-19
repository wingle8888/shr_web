const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(process.cwd(), "data", "visits.json");
const TMP_FILE = path.join("/tmp", "shr-visits.json");
const MAX_UV_IDS = 3000;
const MAX_DAYS = 400;

function dayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthKeyFromDay(day) {
  return String(day || "").slice(0, 7);
}

function readVisits() {
  try {
    if (fs.existsSync(TMP_FILE)) return JSON.parse(fs.readFileSync(TMP_FILE, "utf8"));
  } catch (_) {}
  try {
    if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch (_) {}
  return { days: {} };
}

function writeVisits(data) {
  const payload = data && typeof data === "object" ? data : { days: {} };
  if (!payload.days || typeof payload.days !== "object") payload.days = {};

  const keys = Object.keys(payload.days).sort();
  if (keys.length > MAX_DAYS) {
    keys.slice(0, keys.length - MAX_DAYS).forEach((k) => delete payload.days[k]);
  }

  const text = JSON.stringify(payload);
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, text);
  } catch (_) {}
  try {
    fs.writeFileSync(TMP_FILE, text);
  } catch (_) {}
  return payload;
}

function recordVisit({ visitorId, pathName, referrer } = {}) {
  const data = readVisits();
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
  writeVisits(data);
  return {
    day: key,
    pv: row.pv,
    uv: row.uvIds.length,
  };
}

function buildVisitStats(raw) {
  const data = raw || readVisits();
  const daysMap = data.days || {};
  const today = dayKey();
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const daily = Object.keys(daysMap)
    .sort()
    .map((day) => {
      const row = daysMap[day] || {};
      return {
        day,
        pv: Number(row.pv) || 0,
        uv: Array.isArray(row.uvIds) ? row.uvIds.length : Number(row.uv) || 0,
      };
    });

  const byMonth = {};
  daily.forEach((d) => {
    const m = monthKeyFromDay(d.day);
    if (!byMonth[m]) byMonth[m] = { month: m, pv: 0, uv: 0, days: 0 };
    byMonth[m].pv += d.pv;
    byMonth[m].uv += d.uv;
    byMonth[m].days += 1;
  });
  const monthly = Object.values(byMonth).sort((a, b) => String(a.month).localeCompare(String(b.month)));

  const todayRow = daily.find((d) => d.day === today) || { day: today, pv: 0, uv: 0 };
  const monthRow = byMonth[thisMonth] || { month: thisMonth, pv: 0, uv: 0, days: 0 };

  const last30 = daily.slice(-30);
  const last12Months = monthly.slice(-12);

  return {
    today: todayRow,
    thisMonth: monthRow,
    daily: last30,
    monthly: last12Months,
    totalPv: daily.reduce((s, d) => s + d.pv, 0),
    totalUv: daily.reduce((s, d) => s + d.uv, 0),
  };
}

module.exports = {
  readVisits,
  writeVisits,
  recordVisit,
  buildVisitStats,
  dayKey,
};
