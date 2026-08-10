// Return a client board's real Month options, so the Add-video form's Month
// dropdown matches what's actually on that board (each client names its
// billing cycle differently: "SEPTEMBER-OCTOBER", "Month (Billing Cycle)", …).
// Accepts: { client }  — any logged-in user.

const { getUser } = require("../lib/auth");
const { notion } = require("../lib/notion");
const CLIENTS = require("../config/clients");

function findMonthProp(P) {
  return Object.keys(P).find((k) => /month/i.test(k)) || null;
}

module.exports = async (req, res) => {
  const u = getUser(req);
  if (!u) return res.status(401).json({ error: "Not logged in" });
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body || "{}"); } catch { body = {}; } }
  const { client } = body || {};
  if (!client) return res.status(400).json({ error: "Pick a client" });

  const cfg = CLIENTS.find((c) => c.name === client);
  if (!cfg) return res.status(400).json({ error: `Unknown client "${client}"` });

  try {
    const db = await notion.databases.retrieve({ database_id: cfg.databaseId });
    const P = db.properties;
    const key = findMonthProp(P);
    if (!key) return res.json({ prop: null, options: [] });
    const prop = P[key];
    const bag = prop.select || prop.multi_select || prop.status;
    const options = (bag && bag.options ? bag.options : []).map((o) => o.name);
    return res.json({ prop: key, options });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
};
