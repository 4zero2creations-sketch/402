import { clearSessionCookie, json } from "./_auth.js";

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  return json({ ok: true }, 200, { "set-cookie": clearSessionCookie() });
};
