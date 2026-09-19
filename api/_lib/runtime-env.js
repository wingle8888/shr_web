const SKIP_BINDINGS = new Set(["ASSETS", "CF"]);

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

function looksLikeR2(binding) {
  if (!binding) return false;
  if (typeof binding.fetch === "function") return false;
  return typeof binding.get === "function" && typeof binding.put === "function" && typeof binding.head === "function";
}

function looksLikeKV(binding) {
  if (!binding) return false;
  if (typeof binding.fetch === "function") return false;
  return typeof binding.get === "function" && typeof binding.put === "function" && typeof binding.head !== "function";
}

function namedBinding(env, names, test) {
  if (!env) return null;
  for (let i = 0; i < names.length; i += 1) {
    const name = names[i];
    if (SKIP_BINDINGS.has(name)) continue;
    const value = env[name];
    if (test(value)) return value;
  }
  return null;
}

function getR2() {
  if (globalThis.__SHR_R2_DISABLED) return null;
  return namedBinding(getRuntimeEnv(), ["SHR_BUCKET", "R2", "BUCKET"], looksLikeR2);
}

function disableR2() {
  globalThis.__SHR_R2_DISABLED = true;
}

function getKV() {
  if (globalThis.__SHR_KV_DISABLED) return null;
  return namedBinding(getRuntimeEnv(), ["SHR_KV", "KV"], looksLikeKV);
}

function disableKV() {
  globalThis.__SHR_KV_DISABLED = true;
}

function isCloudflare() {
  const env = getRuntimeEnv();
  if (env && env.ASSETS) return true;
  try {
    if (typeof WebSocketPair !== "undefined") return true;
  } catch (_) {}
  try {
    if (process.env.CF_PAGES || process.env.CF_PAGES_URL) return true;
  } catch (_) {}
  return Boolean(getR2() || getKV());
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
