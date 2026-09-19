const {
  cors,
  sendJson,
  parseBody,
  readUsers,
  writeUsers,
  hashPassword,
  signToken,
  publicUser,
  storageStatus,
} = require("../_lib/auth-store");

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== "POST") {
    sendJson(res, 405, { ok: false, error: "method not allowed" });
    return;
  }

  const status = storageStatus();
  if (!status.ok) {
    sendJson(res, 503, {
      ok: false,
      code: "BLOB_MISSING",
      error: "server storage not configured",
      detail: status.message,
      storage: status.storage,
      hasToken: Boolean(status.hasToken),
      storeId: status.storeId || null,
    });
    return;
  }

  const body = parseBody(req);
  const email = String(body.email || "")
    .trim()
    .toLowerCase();
  const password = String(body.password || "");
  const passwordConfirm = String(body.passwordConfirm != null ? body.passwordConfirm : password);
  const name = String(body.name || "").trim();
  const phone = String(body.phone || "").replace(/[\s-]/g, "").trim();

  if (!email || !password || !name) {
    sendJson(res, 400, { ok: false, error: "name, email and password required" });
    return;
  }
  if (!phone) {
    sendJson(res, 400, { ok: false, error: "phone required" });
    return;
  }
  if (password !== passwordConfirm) {
    sendJson(res, 400, { ok: false, error: "password mismatch" });
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    sendJson(res, 400, { ok: false, error: "invalid email" });
    return;
  }
  if (password.length < 6) {
    sendJson(res, 400, { ok: false, error: "password too short" });
    return;
  }

  try {
    const users = await readUsers();
    if (users.some((u) => u.email === email)) {
      sendJson(res, 409, { ok: false, error: "email already registered" });
      return;
    }

    const { salt, hash } = hashPassword(password);
    const user = {
      id: `u${Date.now()}`,
      email,
      name,
      phone,
      salt,
      hash,
      createdAt: new Date().toISOString(),
      source: "server",
    };
    users.push(user);
    const saved = await writeUsers(users);

    sendJson(res, 200, {
      ok: true,
      token: signToken(user),
      user: publicUser(user),
      storage: saved.storage || "blob",
      needSync: false,
    });
  } catch (err) {
    const code = err && err.code ? err.code : "";
    if (code === "BLOB_MISSING") {
      sendJson(res, 503, {
        ok: false,
        code,
        error: "server storage not configured",
        detail: "未检测到 Cloudflare R2，请绑定 SHR_BUCKET 并重新部署",
      });
      return;
    }
    if (code === "BLOB_WRITE_FAILED") {
      sendJson(res, 503, {
        ok: false,
        code,
        error: "server storage write failed",
        detail: String(err.message || "注册资料写入云存储失败，请稍后重试"),
      });
      return;
    }
    sendJson(res, 500, { ok: false, error: String(err.message || err) });
  }
};
