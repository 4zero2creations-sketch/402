import { getStore } from "@netlify/blobs";
import { requireUser, json } from "./_auth.js";

const STORE = "4zero2-internal";

function makeId() {
  const d = new Date();
  const date = d.toISOString().slice(0, 10).replaceAll("-", "");
  const rand = crypto.randomUUID().slice(0, 8);
  return `Q-${date}-${rand}`;
}

export default async (req) => {
  const { user, error } = await requireUser();
  if (error) return error;
  const store = getStore(STORE);

  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
    const id = makeId();
    const quote = { ...body, id, createdAt: new Date().toISOString(), createdBy: user.email };
    await store.setJSON(`quotes/${id}`, quote);
    return json({ ok: true, quote }, 201);
  }

  if (req.method === "GET") {
    const { blobs } = await store.list({ prefix: "quotes/" });
    const recent = blobs.sort((a, b) => String(b.key).localeCompare(String(a.key))).slice(0, 100);
    const quotes = [];
    for (const b of recent) {
      const q = await store.get(b.key, { type: "json" });
      if (q) quotes.push(q);
    }
    quotes.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return json({ quotes: quotes.slice(0, 50) });
  }

  return json({ error: "Method not allowed" }, 405);
};
