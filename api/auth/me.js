const { cors, sendJson, resolveUserFromToken, publicUser } = require("../_lib/auth-store");

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
  try {
    const user = await resolveUserFromToken(token);
    if (!user) {
      sendJson(res, 401, { ok: false, error: "unauthorized" });
      return;
    }
    sendJson(res, 200, {
      ok: true,
      user: publicUser(user),
    });
  } catch (err) {
    sendJson(res, 500, { ok: false, error: String(err.message || err) });
  }
};
