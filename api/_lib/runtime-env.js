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
  return Boolean(
    binding &&
      typeof binding.get === "function" &&
      typeof binding.put === "function" &&
      typeof binding.head === "function"
  );
}

function looksLikeKV(binding) {
  return Boolean(
    binding &&
      typeof binding.get === "function" &&
      typeof binding.put === "function" &&
      typeof binding.head !== "function"
  );
}

function firstBinding(env, names, test) {
  if (!env) return null;
  for (let i = 0; i < names.length; i += 1) {
    const value = env[names[i]];
    if (test(value)) return value;
  }
  try {
    for (const key in env) {
      if (test(env[key])) return env[key];
    }
  } catch (_) {}
  return null;
}

function getR2() {
  return firstBinding(getRuntimeEnv(), ["SHR_BUCKET", "R2", "BUCKET", "develop-boards", "develop_boards", "DEVELOP_BOARDS"], looksLikeR2);
}

function getKV() {
  return firstBinding(getRuntimeEnv(), ["SHR_KV", "KV"], looksLikeKV);
}

function isCloudflare() {
  if (getR2() || getKV()) return true;
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
  getKV,
  isCloudflare,
};
