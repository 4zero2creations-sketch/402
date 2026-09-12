import { getStore } from "@netlify/blobs";

export default async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  let body;
  try { body = await req.json(); } catch { return new Response("Bad request", { status: 400 }); }
  if (!body?.pinSha256 || !body?.sessionSecret) return new Response("Missing config", { status: 400 });
  const store = getStore("4zero2-auth", { consistency: "strong" });
  await store.setJSON("config", {
    pinSha256: String(body.pinSha256),
    sessionSecret: String(body.sessionSecret),
    initializedAt: new Date().toISOString()
  });
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json", "cache-control": "no-store" }
  });
};
