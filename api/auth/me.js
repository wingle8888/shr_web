const { cors, sendJson, verifyToken } = require("../_lib/auth-store");

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== "GET") {
    sendJson(res, 405, { ok: false, error: "method not allowed" });
    return;
  }

  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const data = verifyToken(token);
  if (!data) {
    sendJson(res, 401, { ok: false, error: "unauthorized" });
    return;
  }
  sendJson(res, 200, {
    ok: true,
    user: { id: data.id, email: data.email, name: data.name },
  });
};
