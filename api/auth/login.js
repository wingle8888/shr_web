const {
  cors,
  sendJson,
  parseBody,
  readUsers,
  verifyPassword,
  signToken,
  publicUser,
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

  const body = parseBody(req);
  const email = String(body.email || "")
    .trim()
    .toLowerCase();
  const password = String(body.password || "");

  if (!email || !password) {
    sendJson(res, 400, { ok: false, error: "email and password required" });
    return;
  }

  const user = readUsers().find((u) => u.email === email);
  if (!user || !verifyPassword(password, user.salt, user.hash)) {
    sendJson(res, 401, { ok: false, error: "invalid credentials" });
    return;
  }

  sendJson(res, 200, { ok: true, token: signToken(user), user: publicUser(user) });
};
