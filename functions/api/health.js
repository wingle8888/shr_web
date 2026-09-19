export async function onRequest() {
  return new Response(JSON.stringify({ ok: true, runtime: "cloudflare" }), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
