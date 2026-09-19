const { cors, sendJson, parseBody } = require("./_lib/docs-store");
const { recordVisit } = require("./_lib/visits-store");

module.exports = async function handler(req, res) {
  cors(res);
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
  const pathName = String(body.path || body.pathName || "").trim();
  // 不统计后台与客户端下载页
  if (/^\/admin/i.test(pathName) || /^\/client/i.test(pathName)) {
    sendJson(res, 200, { ok: true, skipped: true });
    return;
  }

  const result = recordVisit({
    visitorId: body.visitorId,
    pathName: pathName || "/",
    referrer: body.referrer,
  });
  sendJson(res, 200, { ok: true, ...result });
};
