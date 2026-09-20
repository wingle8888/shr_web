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
  findUsersByAccount,
} = require("../_lib/auth-store");

function accountFrom(body) {
  return String((body && (body.account || body.email || body.phone)) || "").trim();
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

  const account = accountFrom(body);
  const password = String(body.password || "");
  const passwordConfirm = String(body.passwordConfirm != null ? body.passwordConfirm : password);

  if (!account || !password) {
    sendJson(res, 400, { ok: false, error: "account and password required" });
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
    const hits = findUsersByAccount(users, account);
    if (hits.length !== 1) {
      sendJson(res, 400, { ok: false, error: "account not found" });
      return;
    }
    const user = hits[0];
    const idx = users.findIndex((u) => u && (u.id === user.id || u.email === user.email));
    if (idx < 0) {
      sendJson(res, 400, { ok: false, error: "account not found" });
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

  const account = accountFrom(body);
  const password = String(body.password || "");

  if (!account || !password) {
    sendJson(res, 400, { ok: false, error: "account and password required" });
    return;
  }

  const users = await readUsers();
  const user = findUsersByAccount(users, account).find(
    (u) => u && u.salt && u.hash && verifyPassword(password, u.salt, u.hash)
  );
  if (!user) {
    sendJson(res, 401, { ok: false, error: "invalid credentials" });
    return;
  }

  sendJson(res, 200, { ok: true, token: signToken(user), user: publicUser(user) });
};
