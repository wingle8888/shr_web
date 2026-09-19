const {
  cors,
  sendJson,
  parseBody,
  readUsers,
  writeUsers,
  hashPassword,
  signToken,
  publicUser,
  hasBlob,
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
  const name = String(body.name || "").trim();
  const phone = String(body.phone || "").trim();

  if (!email || !password || !name) {
    sendJson(res, 400, { ok: false, error: "name, email and password required" });
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
  await writeUsers(users);

  const token = signToken(user);
  sendJson(res, 200, {
    ok: true,
    token,
    user: publicUser(user),
    storage: hasBlob() ? "blob" : "ephemeral",
  });
};
