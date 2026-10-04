import { getStore, getDeployStore } from "@netlify/blobs";
import { requireUser, json } from "./_auth.js";

const defaults = {"catalog":[{"name":"Blank Provided By Customer","price":0},{"name":"T-Shirt Short Sleeve S to XL","price":6},{"name":"T-Shirt Short Sleeve 2XL up","price":9},{"name":"T-Shirt Long Sleeve S to XL","price":8},{"name":"T-Shirt Long Sleeve 2XL up","price":11},{"name":"Sweatshirt S to XL","price":8},{"name":"Sweetshirt 2XL up","price":13},{"name":"Hoodie Zip up","price":14},{"name":"Hoodie pull over","price":12},{"name":"Richardson Hat 112","price":6},{"name":"SS Tumbler 20oz","price":7},{"name":"SS Tumbler 32oz","price":8},{"name":"Slate 4x4 coaster","price":1},{"name":"Wood 4 coaster holder Unstained 3mm","price":1.25},{"name":"Wood 4 coaster holder stained 3mm","price":2.5},{"name":"3x3 pine coaster","price":1},{"name":"SS earrings","price":1.1},{"name":"Brass Earings","price":1.1},{"name":"Custom wood sign 3mm basswood by sq/in","price":0.05},{"name":"Cutsom wood sign 6mm birtch by sq/in","price":0.1}],"transfers":[{"name":"DTF printed","price":0.01},{"name":"DTF purchased","price":0.04},{"name":"Heat press work","price":0.01}],"fees":[{"name":"Purchased DTF processing / setup","price":10},{"name":"Printed DTF process / setup","price":15},{"name":"Artwork clean up","price":15},{"name":"Design - rework design / hr","price":30}],"settings":{"kWh_Rate":0.12,"Setup_Fee":5,"Markup":2,"Labor_Rate":30,"Diode_Watts":275,"IR_Watts":150,"Press_Watts":1600,"Press_Rate":0.25,"Diode_Rate":1.5,"IR_Rate":1,"Tax_Rate":0.075,"Print_Labor_Rate":0.25,"Printer_Rate":0.35,"Printer_Watts":300},"meta":{"version":1,"updatedAt":null,"updatedBy":null}};

const STORE = "4zero2-internal";
const KEY = "shop-config";

function getBlobStore() {
  const deployContext = globalThis.Netlify?.context?.deploy?.context;
  if (deployContext === "production") return getStore(STORE, { consistency: "strong" });
  return getDeployStore(STORE);
}

export default async (req) => {
  const { user, error } = await requireUser(req);
  if (error) return error;
  const store = getBlobStore();

  if (req.method === "GET") {
    let config = await store.get(KEY, { type: "json" });
    if (!config) {
      config = structuredClone(defaults);
      config.meta = { ...(config.meta || {}), version: 1, updatedAt: new Date().toISOString(), updatedBy: user.email };
      await store.setJSON(KEY, config);
    }
    return json({ config, user: { id: user.id, email: user.email } });
  }

  if (req.method === "PUT") {
    let body;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
    const config = body?.config;
    if (!config || !Array.isArray(config.catalog) || !config.settings) return json({ error: "Invalid configuration" }, 400);
    const existing = await store.get(KEY, { type: "json" });
    const nextVersion = Number(existing?.meta?.version || 0) + 1;
    config.meta = { ...(config.meta || {}), version: nextVersion, updatedAt: new Date().toISOString(), updatedBy: user.email };
    await store.setJSON(KEY, config);
    return json({ ok: true, config });
  }

  return json({ error: "Method not allowed" }, 405);
};
