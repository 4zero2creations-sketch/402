import { createHash, timingSafeEqual } from "node:crypto";
import { createSessionToken, sessionCookie, json } from "./_auth.js";

function pinHash() {
  return globalThis.Netlify?.env?.get("QDESK_PIN_SHA256") || "";
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ error: "Invalid request" }, 400); }
  const pin = String(body?.pin || "");
  const actual = createHash("sha256").update(pin).digest("hex");
  const expected = pinHash();
  if (!expected) return json({ error: "Authentication is not configured" }, 500);
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return json({ error: "Incorrect PIN" }, 401);
  const token = createSessionToken();
  return json({ ok: true }, 200, { "set-cookie": sessionCookie(token) });
};
