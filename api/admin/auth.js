const { cors, sendJson, parseBody } = require("../_lib/docs-store");
const { checkAdmin, changeAdminPassword } = require("../_lib/admin-auth");

module.exports = async function handler(req, res) {
  cors(res);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-password");

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
  req.body = body;

  if (!(await checkAdmin(req))) {
    sendJson(res, 401, { ok: false, error: "unauthorized" });
    return;
  }

  const action = String(body.action || "change-password").trim();
  if (action !== "change-password") {
    sendJson(res, 400, { ok: false, error: "unknown action" });
    return;
  }

  try {
    const result = await changeAdminPassword({
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
    });
    if (!result.ok) {
      sendJson(res, 400, result);
      return;
    }
    sendJson(res, 200, { ok: true });
  } catch (err) {
    sendJson(res, err && err.code === "BLOB_MISSING" ? 503 : 500, {
      ok: false,
      error: err && err.code === "BLOB_MISSING" ? "密码未能保存到服务器，请重试" : String(err.message || err),
    });
  }
};
