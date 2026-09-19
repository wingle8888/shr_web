const { cors, sendJson, checkAdmin, parseBody } = require("../_lib/docs-store");
const { listThreads, getThread, appendMessage, markRead, getAutoReply, setAutoReply } = require("../_lib/chat-store");

module.exports = async function handler(req, res) {
  cors(res);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-password");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (!checkAdmin(req)) {
    sendJson(res, 401, { ok: false, error: "unauthorized" });
    return;
  }

  if (req.method === "GET") {
    try {
      const url = new URL(req.url, "http://localhost");
      const visitorId = String(url.searchParams.get("visitorId") || "").trim();
      if (visitorId) {
        const thread = await getThread(visitorId);
        if (thread) await markRead(visitorId, "admin");
        sendJson(res, 200, {
          ok: true,
          conversation: thread
            ? { ...thread, unreadAdmin: 0 }
            : null,
        });
        return;
      }
      const threads = await listThreads();
      const unread = threads.reduce((s, t) => s + (Number(t.unreadAdmin) || 0), 0);
      const autoReply = await getAutoReply();
      sendJson(res, 200, { ok: true, threads, unread, autoReply });
    } catch (err) {
      sendJson(res, 500, { ok: false, error: String(err.message || err) });
    }
    return;
  }

  if (req.method === "POST") {
    const body = parseBody(req);
    if (String(body.action || "").trim() === "settings") {
      try {
        const autoReply = await setAutoReply({
          enabled: Boolean(body.enabled),
          message: body.message,
        });
        sendJson(res, 200, { ok: true, autoReply });
      } catch (err) {
        sendJson(res, err && err.code === "BLOB_MISSING" ? 503 : 500, {
          ok: false,
          error: err && err.code === "BLOB_MISSING" ? "数据未能保存到服务器，请重试" : String(err.message || err),
        });
      }
      return;
    }
    const visitorId = String(body.visitorId || "").trim();
    const text = String(body.text || "").trim();
    if (!visitorId || !text) {
      sendJson(res, 400, { ok: false, error: "visitorId and text required" });
      return;
    }
    try {
      const thread = await appendMessage({
        visitorId,
        role: "admin",
        text,
        mark: "customer",
      });
      await markRead(visitorId, "admin");
      sendJson(res, 200, {
        ok: true,
        conversation: { ...thread, unreadAdmin: 0 },
      });
    } catch (err) {
      sendJson(res, err && err.code === "BLOB_MISSING" ? 503 : 500, {
        ok: false,
        error: err && err.code === "BLOB_MISSING" ? "数据未能保存到服务器，请重试" : String(err.message || err),
      });
    }
    return;
  }

  sendJson(res, 405, { ok: false, error: "method not allowed" });
};
