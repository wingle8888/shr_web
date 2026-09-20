const { cors, sendJson, checkAdmin, parseBody } = require("../_lib/docs-store");
const {
  readUsers,
  writeUsers,
  mergeUsers,
  publicUser,
  storageStatus,
  deleteUsers,
  clearUsers,
} = require("../_lib/auth-store");

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

  const status = storageStatus();

  function payload(users, extra) {
    const list = Array.isArray(users) ? users : [];
    return Object.assign(
      {
        ok: true,
        users: list.map(publicUser),
        count: list.length,
        storage: status.storage,
        storageOk: status.ok,
        storageMessage: status.message,
      },
      extra || {}
    );
  }

  if (req.method === "GET") {
    try {
      sendJson(res, 200, payload(await readUsers()));
    } catch (err) {
      sendJson(res, 500, { ok: false, error: String(err.message || err), storage: status.storage });
    }
    return;
  }

  if (req.method === "POST") {
    const action = String(body.action || "").trim();
    if (action === "import") {
      if (!status.ok) {
        sendJson(res, 503, {
          ok: false,
          error: "server storage not configured",
          detail: status.message,
        });
        return;
      }
      try {
        const incoming = Array.isArray(body.users) ? body.users : [];
        const normalized = incoming
          .map((u) => {
            const email = String(u.email || "")
              .trim()
              .toLowerCase();
            if (!email) return null;
            return {
              id: u.id || `lu${Date.now()}${Math.floor(Math.random() * 1000)}`,
              email,
              name: String(u.name || "").trim() || email.split("@")[0],
              phone: String(u.phone || "").trim(),
              createdAt: u.createdAt || new Date().toISOString(),
              source: u.source || "import",
              salt: u.salt || "",
              hash: u.hash || "",
              localHash: Boolean(u.localHash || u.hash),
              registerPlace: u.registerPlace || null,
            };
          })
          .filter(Boolean);

        const current = await readUsers();
        const merged = mergeUsers(current, normalized);
        const saved = await writeUsers(merged);
        sendJson(res, 200, payload(saved.users || merged, { imported: normalized.length }));
      } catch (err) {
        sendJson(res, 500, { ok: false, error: String(err.message || err) });
      }
      return;
    }
    if (action === "delete") {
      try {
        const saved = await deleteUsers(body.ids || body.id || body.email);
        sendJson(res, 200, payload(saved.users));
      } catch (err) {
        sendJson(res, err && err.code === "BLOB_MISSING" ? 503 : 500, {
          ok: false,
          error: err && err.code === "BLOB_MISSING" ? "数据未能保存到服务器，请重试" : String(err.message || err),
        });
      }
      return;
    }
    if (action === "clear") {
      try {
        const saved = await clearUsers();
        sendJson(res, 200, payload(saved.users));
      } catch (err) {
        sendJson(res, err && err.code === "BLOB_MISSING" ? 503 : 500, {
          ok: false,
          error: err && err.code === "BLOB_MISSING" ? "数据未能保存到服务器，请重试" : String(err.message || err),
        });
      }
      return;
    }
    sendJson(res, 400, { ok: false, error: "unknown action" });
    return;
  }

  sendJson(res, 405, { ok: false, error: "method not allowed" });
};
