const {
  cors,
  sendJson,
  parseBody,
  readUsers,
  writeUsers,
  hashPassword,
  verifyPassword,
  signToken,
  publicUser,
  storageStatus,
} = require("../_lib/auth-store");

function normalizePhone(value) {
  return String(value || "").replace(/[\s\-()+]/g, "").trim();
}

async function handleReset(req, res, body) {
  const status = storageStatus();
  if (!status.ok) {
    sendJson(res, 503, {
      ok: false,
      error: "server storage not configured",
      detail: status.message,
    });
    return;
  }

  const email = String(body.email || "")
    .trim()
    .toLowerCase();
  const phone = normalizePhone(body.phone);
  const password = String(body.password || "");
  const passwordConfirm = String(body.passwordConfirm != null ? body.passwordConfirm : password);

  if (!email || !phone || !password) {
    sendJson(res, 400, { ok: false, error: "email, phone and password required" });
    return;
  }
  if (password !== passwordConfirm) {
    sendJson(res, 400, { ok: false, error: "password mismatch" });
    return;
  }
  if (password.length < 6) {
    sendJson(res, 400, { ok: false, error: "password too short" });
    return;
  }

  try {
    const users = await readUsers();
    const idx = users.findIndex((u) => u && u.email === email);
    if (idx < 0) {
      sendJson(res, 400, { ok: false, error: "phone mismatch" });
      return;
    }
    const user = users[idx];
    const storedPhone = normalizePhone(user.phone);
    if (!storedPhone) {
      sendJson(res, 400, { ok: false, error: "no phone" });
      return;
    }
    if (storedPhone !== phone) {
      sendJson(res, 400, { ok: false, error: "phone mismatch" });
      return;
    }

    const { salt, hash } = hashPassword(password);
    users[idx] = { ...user, salt, hash };
    await writeUsers(users);
    sendJson(res, 200, { ok: true, reset: true });
  } catch (err) {
    sendJson(res, 500, { ok: false, error: String(err.message || err) });
  }
}

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

  const body = parseBody(req);
  if (body.action === "reset") {
    await handleReset(req, res, body);
    return;
  }

  const email = String(body.email || "")
    .trim()
    .toLowerCase();
  const password = String(body.password || "");

  if (!email || !password) {
    sendJson(res, 400, { ok: false, error: "email and password required" });
    return;
  }

  const users = await readUsers();
  const user = users.find((u) => u.email === email);
  if (!user || !user.salt || !user.hash || !verifyPassword(password, user.salt, user.hash)) {
    sendJson(res, 401, { ok: false, error: "invalid credentials" });
    return;
  }

  sendJson(res, 200, { ok: true, token: signToken(user), user: publicUser(user) });
};
