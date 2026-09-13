import { getStore, getDeployStore } from "@netlify/blobs";
import { requireUser, json } from "./_auth.js";

const STORE = "4zero2-internal";

function getBlobStore() {
  const deployContext = globalThis.Netlify?.context?.deploy?.context;
  if (deployContext === "production") return getStore(STORE, { consistency: "strong" });
  return getDeployStore(STORE);
}

function makeId() {
  const d = new Date();
  const date = d.toISOString().slice(0, 10).replaceAll("-", "");
  return `Q-${date}-${crypto.randomUUID().slice(0, 8)}`;
}

export default async (req) => {
  const { user, error } = await requireUser(req);
  if (error) return error;
  const store = getBlobStore();

  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
    const now = new Date().toISOString();
    const id = makeId();
    const quote = { ...body, id, revision: 1, createdAt: now, createdBy: user.email, updatedAt: now, updatedBy: user.email, revisions: [] };
    await store.setJSON(`quotes/${id}`, quote);
    return json({ ok: true, quote }, 201);
  }

  if (req.method === "PUT") {
    let body;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
    const id = String(body?.id || "");
    if (!id || !body?.quote) return json({ error: "Quote id and quote are required" }, 400);
    const existing = await store.get(`quotes/${id}`, { type: "json", consistency: "strong" });
    if (!existing) return json({ error: "Quote not found" }, 404);
    const now = new Date().toISOString();
    const history = Array.isArray(existing.revisions) ? existing.revisions : [];
    history.push({ revision: existing.revision || 1, savedAt: existing.updatedAt || existing.createdAt, savedBy: existing.updatedBy || existing.createdBy, snapshot: { customer: existing.customer, lines: existing.lines, fees: existing.fees, notes: existing.notes, bulkDiscount: existing.bulkDiscount, adjustment: existing.adjustment, pricing: existing.pricing } });
    const quote = { ...body.quote, id, revision: Number(existing.revision || 1) + 1, createdAt: existing.createdAt, createdBy: existing.createdBy, updatedAt: now, updatedBy: user.email, revisions: history.slice(-10) };
    await store.setJSON(`quotes/${id}`, quote);
    return json({ ok: true, quote });
  }

  if (req.method === "GET") {
    const { blobs } = await store.list({ prefix: "quotes/" });
    const recent = blobs.sort((a, b) => String(b.key).localeCompare(String(a.key))).slice(0, 100);
    const quotes = [];
    for (const b of recent) {
      const q = await store.get(b.key, { type: "json" });
      if (q) quotes.push(q);
    }
    quotes.sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)));
    return json({ quotes: quotes.slice(0, 50) });
  }

  return json({ error: "Method not allowed" }, 405);
};
