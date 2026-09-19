function setRuntimeEnv(env) {
  globalThis.__SHR_ENV = env && typeof env === "object" ? env : {};
  const src = globalThis.__SHR_ENV;
  ["ADMIN_PASSWORD", "AUTH_SECRET", "BLOB_READ_WRITE_TOKEN", "BLOB_STORE_ID"].forEach((key) => {
    if (src[key] == null || src[key] === "") return;
    try {
      process.env[key] = String(src[key]);
    } catch (_) {}
  });
}

function getRuntimeEnv() {
  return globalThis.__SHR_ENV && typeof globalThis.__SHR_ENV === "object" ? globalThis.__SHR_ENV : {};
}

function ctorName(value) {
  try {
    return String((value && value.constructor && value.constructor.name) || "");
  } catch (_) {
    return "";
  }
}

function isRealR2(binding) {
  if (!binding || globalThis.__SHR_R2_DISABLED) return false;
  if (typeof binding.fetch === "function") return false;
  const name = ctorName(binding);
  if (name && name !== "R2Bucket") return false;
  return typeof binding.get === "function" && typeof binding.put === "function" && typeof binding.head === "function";
}

function named(env, names, test) {
  if (!env) return null;
  for (let i = 0; i < names.length; i += 1) {
    const value = env[names[i]];
    if (test(value)) return value;
  }
  return null;
}

function getR2() {
  return named(getRuntimeEnv(), ["SHR_BUCKET", "R2"], isRealR2);
}

function disableR2() {
  globalThis.__SHR_R2_DISABLED = true;
}

function getKV() {
  return null;
}

function disableKV() {}

function isCloudflare() {
  const env = getRuntimeEnv();
  if (env && env.ASSETS) return true;
  try {
    if (typeof WebSocketPair !== "undefined") return true;
  } catch (_) {}
  try {
    if (process.env.CF_PAGES || process.env.CF_PAGES_URL) return true;
  } catch (_) {}
  return false;
}

module.exports = {
  setRuntimeEnv,
  getRuntimeEnv,
  getR2,
  disableR2,
  getKV,
  disableKV,
  isCloudflare,
};
