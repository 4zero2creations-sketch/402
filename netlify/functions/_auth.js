import { createHmac, timingSafeEqual } from "node:crypto";
import { getStore } from "@netlify/blobs";

const COOKIE = "qdesk_session";
const AUTH_STORE = "4zero2-auth";
const AUTH_KEY = "config";

export async function getAuthConfig() {
  const store = getStore(AUTH_STORE, { consistency: "strong" });
  return await store.get(AUTH_KEY, { type: "json" });
}

function sign(payload, secret) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function parseCookies(req) {
  const raw = req.headers.get("cookie") || "";
  return Object.fromEntries(raw.split(";").map(v => v.trim()).filter(Boolean).map(v => {
    const i = v.indexOf("=");
    return i < 0 ? [v, ""] : [v.slice(0, i), decodeURIComponent(v.slice(i + 1))];
  }));
}

export function createSessionToken(secret) {
  const payload = Buffer.from(JSON.stringify({ role: "staff", exp: Date.now() + 30 * 24 * 60 * 60 * 1000 })).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

export function sessionCookie(token) {
  return `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`;
}

export function clearSessionCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export async function verifySession(req) {
  const cfg = await getAuthConfig();
  const secret = String(cfg?.sessionSecret || "");
  if (!secret) return null;
  const token = parseCookies(req)[COOKIE];
  if (!token || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  const expected = sign(payload, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (data.role !== "staff" || Number(data.exp) < Date.now()) return null;
    return { id: "staff", email: "4Zero2 staff", role: "staff" };
  } catch {
    return null;
  }
}

export async function requireUser(req) {
  const user = await verifySession(req);
  if (!user) return { user: null, error: json({ error: "Unauthorized" }, 401) };
  return { user, error: null };
}

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...extraHeaders }
  });
}
