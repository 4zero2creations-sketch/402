import { createHash, timingSafeEqual } from "node:crypto";
import { createSessionToken, sessionCookie, json, getAuthConfig } from "./_auth.js";

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ error: "Invalid request" }, 400); }

  const cfg = await getAuthConfig();
  const expected = String(cfg?.pinSha256 || "");
  const sessionSecret = String(cfg?.sessionSecret || "");
  if (!expected || !sessionSecret) return json({ error: "Authentication is not configured" }, 500);

  const pin = String(body?.pin || "");
  const actual = createHash("sha256").update(pin).digest("hex");
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return json({ error: "Incorrect PIN" }, 401);

  const token = createSessionToken(sessionSecret);
  return json({ ok: true }, 200, { "set-cookie": sessionCookie(token) });
};
