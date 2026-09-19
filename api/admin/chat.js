const { cors, sendJson, checkAdmin, parseBody } = require("../_lib/docs-store");
const { listThreads, getThread, appendMessage, markRead, getAutoReply, setAutoReply, displayTitle, readPresence, touchPresence, presenceFlags, withCustomerOnline, deleteMessage, clearThread, deleteThread } = require("../_lib/chat-store");

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
      const wantPresence = String(url.searchParams.get("presence") || "") === "1";
      const presence = wantPresence ? await touchPresence({ role: "admin" }) : await readPresence();
      if (visitorId) {
        const thread = await getThread(visitorId);
        if (thread) await markRead(visitorId, "admin");
        const flags = presenceFlags(presence, visitorId);
        sendJson(res, 200, {
          ok: true,
          sellerOnline: flags.sellerOnline,
          conversation: thread
            ? {
                ...thread,
                unreadAdmin: 0,
                displayName: displayTitle(thread),
                online: flags.customerOnline,
              }
            : null,
        });
        return;
      }
      const threads = withCustomerOnline(await listThreads(), presence);
      const unread = threads.reduce((s, t) => s + (Number(t.unreadAdmin) || 0), 0);
      const autoReply = await getAutoReply();
      sendJson(res, 200, { ok: true, threads, unread, autoReply, sellerOnline: presenceFlags(presence).sellerOnline });
    } catch (err) {
      sendJson(res, 500, { ok: false, error: String(err.message || err) });
    }
    return;
  }

  if (req.method === "POST") {
    const body = parseBody(req);
    const action = String(body.action || "").trim();
    if (action === "settings") {
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
    if (action === "delete-message" || action === "clear-thread" || action === "delete-thread") {
      if (!visitorId) {
        sendJson(res, 400, { ok: false, error: "visitorId required" });
        return;
      }
      try {
        if (action === "delete-thread") {
          const removed = await deleteThread(visitorId);
          sendJson(res, 200, { ok: true, removed: Boolean(removed) });
          return;
        }
        const thread = action === "clear-thread"
          ? await clearThread(visitorId)
          : await deleteMessage(visitorId, body.messageId);
        if (!thread) {
          sendJson(res, 404, { ok: false, error: "conversation not found" });
          return;
        }
        const presence = await readPresence();
        const flags = presenceFlags(presence, visitorId);
        sendJson(res, 200, {
          ok: true,
          conversation: {
            ...thread,
            displayName: displayTitle(thread),
            online: flags.customerOnline,
          },
        });
      } catch (err) {
        sendJson(res, err && err.code === "BLOB_MISSING" ? 503 : 500, {
          ok: false,
          error: err && err.code === "BLOB_MISSING" ? "数据未能保存到服务器，请重试" : String(err.message || err),
        });
      }
      return;
    }
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
      const presence = await touchPresence({ role: "admin" });
      const flags = presenceFlags(presence, visitorId);
      sendJson(res, 200, {
        ok: true,
        sellerOnline: flags.sellerOnline,
        conversation: {
          ...thread,
          unreadAdmin: 0,
          displayName: displayTitle(thread),
          online: flags.customerOnline,
        },
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
