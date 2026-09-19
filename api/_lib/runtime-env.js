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

function getR2() {
  if (globalThis.__SHR_R2_DISABLED) return null;
  const env = getRuntimeEnv();
  const binding = env.SHR_BUCKET || env.R2 || null;
  if (!binding) return null;
  if (typeof binding.fetch === "function") return null;
  if (typeof binding.get !== "function" || typeof binding.put !== "function") return null;
  return binding;
}

function disableR2() {
  globalThis.__SHR_R2_DISABLED = true;
}

function getCatalogStub() {
  const env = getRuntimeEnv();
  const ns = env && env.CATALOG;
  if (!ns || typeof ns.idFromName !== "function" || typeof ns.get !== "function") return null;
  try {
    return ns.get(ns.idFromName("shr-catalog"));
  } catch (_) {
    return null;
  }
}

function getKV() {
  return null;
}

function disableKV() {}

function isCloudflare() {
  const env = getRuntimeEnv();
  if (env && (env.ASSETS || env.CATALOG)) return true;
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
  getCatalogStub,
  getKV,
  disableKV,
  isCloudflare,
};
