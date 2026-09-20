const { cors, sendJson, parseBody, resolveUserFromToken } = require("../_lib/auth-store");
const { ensureWarehouse, patchWarehouse } = require("../_lib/warehouse-store");

function tokenFrom(req) {
  const auth = req.headers.authorization || req.headers.Authorization || "";
  return auth.startsWith("Bearer ") ? auth.slice(7) : "";
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  const token = tokenFrom(req);
  let user;
  try {
    user = await resolveUserFromToken(token);
  } catch (err) {
    sendJson(res, 500, { ok: false, error: String(err.message || err) });
    return;
  }
  if (!user) {
    sendJson(res, 401, { ok: false, error: "unauthorized" });
    return;
  }

  if (req.method === "GET") {
    try {
      const warehouse = await ensureWarehouse(user);
      sendJson(res, 200, { ok: true, warehouse });
    } catch (err) {
      sendJson(res, err && err.code === "BLOB_MISSING" ? 503 : 500, {
        ok: false,
        error: String(err.message || err),
      });
    }
    return;
  }

  if (req.method === "POST") {
    const body = parseBody(req);
    try {
      const warehouse = await patchWarehouse(user, body || {});
      sendJson(res, 200, { ok: true, warehouse });
    } catch (err) {
      sendJson(res, err && err.code === "BLOB_MISSING" ? 503 : 500, {
        ok: false,
        error: String(err.message || err),
      });
    }
    return;
  }

  sendJson(res, 405, { ok: false, error: "method not allowed" });
};
