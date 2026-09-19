const { cors, sendJson, checkAdmin, parseBody } = require("../_lib/docs-store");
const { readUsers, writeUsers, mergeUsers, publicUser, hasBlob } = require("../_lib/auth-store");

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

  if (!checkAdmin(req)) {
    sendJson(res, 401, { ok: false, error: "unauthorized" });
    return;
  }

  if (req.method === "GET") {
    const users = (await readUsers()).map(publicUser);
    sendJson(res, 200, {
      ok: true,
      users,
      count: users.length,
      storage: hasBlob() ? "blob" : "ephemeral",
    });
    return;
  }

  if (req.method === "POST") {
    const action = String(body.action || "").trim();
    if (action === "import") {
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
            source: "local-sync",
            salt: u.salt || "",
            hash: u.hash || "",
            localHash: Boolean(u.localHash || u.hash),
          };
        })
        .filter(Boolean);

      const current = await readUsers();
      const merged = mergeUsers(current, normalized);
      await writeUsers(merged);
      sendJson(res, 200, {
        ok: true,
        count: merged.length,
        imported: normalized.length,
        storage: hasBlob() ? "blob" : "ephemeral",
      });
      return;
    }
    sendJson(res, 400, { ok: false, error: "unknown action" });
    return;
  }

  sendJson(res, 405, { ok: false, error: "method not allowed" });
};
