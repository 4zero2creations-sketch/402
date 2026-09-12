import { createHash, randomBytes, randomInt } from "node:crypto";
import { getStore } from "@netlify/blobs";

export default async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const pin = String(randomInt(100000, 1000000));
  const pinSha256 = createHash("sha256").update(pin).digest("hex");
  const sessionSecret = randomBytes(48).toString("base64url");
  const store = getStore("4zero2-auth", { consistency: "strong" });
  await store.setJSON("config", {
    pinSha256,
    sessionSecret,
    initializedAt: new Date().toISOString()
  });
  return new Response(JSON.stringify({ ok: true, pin }), {
    status: 200,
    headers: { "content-type": "application/json", "cache-control": "no-store" }
  });
};
