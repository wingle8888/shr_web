const path = require("path");
const { readJsonStore, writeJsonStore } = require("./blob-store");

const BLOB_PATH = "shr-admin/admin-password.json";
const TMP_FILE = path.join("/tmp", "shr-admin-password.json");
const DEFAULT_PASSWORD = "shr-admin-2026";
const MIN_LEN = 6;
const MAX_LEN = 64;

function envPassword() {
  return String(process.env.ADMIN_PASSWORD || "").trim();
}

function defaultPassword() {
  return envPassword() || DEFAULT_PASSWORD;
}

function normalizePassword(value) {
  return String(value || "").trim();
}

function passwordsEqual(a, b) {
  const x = normalizePassword(a);
  const y = normalizePassword(b);
  if (!x || x.length !== y.length) return false;
  let out = 0;
  for (let i = 0; i < x.length; i++) out |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return out === 0;
}

function mergeAuth(a, b) {
  const left = a && typeof a === "object" && !Array.isArray(a) ? a : {};
  const right = b && typeof b === "object" && !Array.isArray(b) ? b : {};
  const leftT = String(left.updatedAt || "");
  const rightT = String(right.updatedAt || "");
  if (right.password && (!left.password || rightT >= leftT)) return { ...left, ...right };
  if (left.password) return { ...right, ...left };
  return { ...left, ...right };
}

async function readAuthRecord() {
  const data = await readJsonStore({
    blobPath: BLOB_PATH,
    localPaths: [TMP_FILE],
    empty: {},
    merge: mergeAuth,
  });
  return data && typeof data === "object" ? data : {};
}

async function writeAuthRecord(password) {
  const payload = {
    password: normalizePassword(password),
    updatedAt: new Date().toISOString(),
  };
  await writeJsonStore({
    blobPath: BLOB_PATH,
    localPaths: [TMP_FILE],
    data: payload,
  });
  return payload;
}

async function getExpectedPassword() {
  const rec = await readAuthRecord();
  const stored = normalizePassword(rec && rec.password);
  if (stored) return stored;
  return defaultPassword();
}

function providedPassword(req) {
  const headers = (req && req.headers) || {};
  const fromHeader = headers["x-admin-password"];
  let bodyPass = "";
  if (req.body && typeof req.body === "object") {
    bodyPass = req.body.password || req.body.currentPassword || "";
  }
  return normalizePassword(fromHeader || bodyPass);
}

async function checkAdmin(req) {
  const given = providedPassword(req);
  if (!given) return false;
  const expected = await getExpectedPassword();
  return passwordsEqual(given, expected);
}

function validateNewPassword(password) {
  const pass = normalizePassword(password);
  if (pass.length < MIN_LEN) return { ok: false, error: `新密码至少 ${MIN_LEN} 位` };
  if (pass.length > MAX_LEN) return { ok: false, error: `新密码最多 ${MAX_LEN} 位` };
  if (/\s/.test(pass)) return { ok: false, error: "新密码不能包含空格" };
  return { ok: true, password: pass };
}

async function changeAdminPassword({ currentPassword, newPassword } = {}) {
  const expected = await getExpectedPassword();
  if (!passwordsEqual(currentPassword, expected)) {
    return { ok: false, error: "当前密码不正确" };
  }
  const valid = validateNewPassword(newPassword);
  if (!valid.ok) return valid;
  if (passwordsEqual(valid.password, expected)) {
    return { ok: false, error: "新密码不能与当前密码相同" };
  }
  await writeAuthRecord(valid.password);
  return { ok: true };
}

module.exports = {
  checkAdmin,
  changeAdminPassword,
  getExpectedPassword,
  DEFAULT_PASSWORD,
};
