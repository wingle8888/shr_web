const { cors, sendJson, parseBody } = require("./_lib/docs-store");
const { getThread, appendMessage, markRead } = require("./_lib/chat-store");

function visitorFrom(req, body) {
  const url = new URL(req.url, "http://localhost");
  return String((body && body.visitorId) || url.searchParams.get("visitorId") || "").trim().slice(0, 64);
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method === "GET") {
    const visitorId = visitorFrom(req, {});
    if (!visitorId) {
      sendJson(res, 400, { ok: false, error: "visitorId required" });
      return;
    }
    try {
      const thread = await getThread(visitorId);
      if (thread && Number(thread.unreadCustomer) > 0) {
        await markRead(visitorId, "customer");
        thread.unreadCustomer = 0;
      }
      sendJson(res, 200, {
        ok: true,
        conversation: thread
          ? {
              id: thread.id,
              visitorId: thread.visitorId,
              messages: thread.messages || [],
              updatedAt: thread.updatedAt,
            }
          : { id: "", visitorId, messages: [], updatedAt: "" },
      });
    } catch (err) {
      sendJson(res, 500, { ok: false, error: String(err.message || err) });
    }
    return;
  }

  if (req.method === "POST") {
    const body = parseBody(req);
    const visitorId = visitorFrom(req, body);
    const text = String(body.text || "").trim();
    if (!visitorId || !text) {
      sendJson(res, 400, { ok: false, error: "visitorId and text required" });
      return;
    }
    try {
      const user = await appendMessage({
        visitorId,
        role: "user",
        text,
        name: body.name,
        email: body.email,
        member: Boolean(body.member),
        userId: body.userId,
        mark: "admin",
      });
      sendJson(res, 200, {
        ok: true,
        conversation: {
          id: user.id,
          visitorId: user.visitorId,
          messages: user.messages || [],
          updatedAt: user.updatedAt,
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
