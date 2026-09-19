const { cors, sendJson, checkAdmin } = require("../_lib/docs-store");
const { readUsers, publicUser } = require("../_lib/auth-store");

module.exports = async function handler(req, res) {
  cors(res);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-password");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "GET") {
    sendJson(res, 405, { ok: false, error: "method not allowed" });
    return;
  }

  if (!checkAdmin(req)) {
    sendJson(res, 401, { ok: false, error: "unauthorized" });
    return;
  }

  const users = readUsers().map(publicUser);
  sendJson(res, 200, { ok: true, users, count: users.length });
};
