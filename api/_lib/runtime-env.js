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
  const env = getRuntimeEnv();
  return env.SHR_BUCKET || env.R2 || null;
}

function isCloudflare() {
  if (getR2()) return true;
  try {
    if (process.env.CF_PAGES || process.env.CF_PAGES_URL) return true;
  } catch (_) {}
  return Boolean(globalThis.__SHR_ENV && Object.keys(globalThis.__SHR_ENV).length);
}

module.exports = {
  setRuntimeEnv,
  getRuntimeEnv,
  getR2,
  isCloudflare,
};
