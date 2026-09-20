const { cors, sendJson, parseBody } = require("../_lib/docs-store");
const { checkAdmin, changeAdminPassword } = require("../_lib/admin-auth");
const { readLoginHistory, appendLogin, deleteLogins, clearLogins, asList } = require("../_lib/login-history-store");

module.exports = async function handler(req, res) {
  cors(res);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-password");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  const body = parseBody(req);
  req.body = body;

  if (!(await checkAdmin(req))) {
    sendJson(res, 401, { ok: false, error: "unauthorized" });
    return;
  }

  if (req.method === "GET") {
    try {
      const data = await readLoginHistory();
      sendJson(res, 200, { ok: true, logins: asList(data) });
    } catch (err) {
      sendJson(res, 500, { ok: false, error: String(err.message || err) });
    }
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { ok: false, error: "method not allowed" });
    return;
  }

  const action = String(body.action || "").trim();

  if (action === "login") {
    try {
      const login = await appendLogin(req, body);
      sendJson(res, 200, { ok: true, login });
    } catch (err) {
      sendJson(res, 200, {
        ok: true,
        recorded: false,
        error: err && err.code === "BLOB_MISSING" ? "登录历史未能保存" : String(err.message || err),
      });
    }
    return;
  }

  if (action === "delete") {
    try {
      const data = await deleteLogins(body.ids || body.id);
      sendJson(res, 200, { ok: true, logins: asList(data) });
    } catch (err) {
      sendJson(res, err && err.code === "BLOB_MISSING" ? 503 : 500, {
        ok: false,
        error: err && err.code === "BLOB_MISSING" ? "登录记录未能删除，请重试" : String(err.message || err),
      });
    }
    return;
  }

  if (action === "clear") {
    try {
      const data = await clearLogins();
      sendJson(res, 200, { ok: true, logins: asList(data) });
    } catch (err) {
      sendJson(res, err && err.code === "BLOB_MISSING" ? 503 : 500, {
        ok: false,
        error: err && err.code === "BLOB_MISSING" ? "登录历史未能清空，请重试" : String(err.message || err),
      });
    }
    return;
  }

  if (action === "change-password") {
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
    return;
  }

  sendJson(res, 400, { ok: false, error: "unknown action" });
};
