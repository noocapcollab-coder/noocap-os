// Add a new video (row) to a client's Notion board. Starts at "1- Idea Assigned".
// Accepts: { client, title, type, format, postDate? } — Scriptwriter / Ops / COO only.
const { getUser } = require("../lib/auth");
const { notion, invalidate } = require("../lib/notion");
const CLIENTS = require("../config/clients");
const NEW_VIDEO_STATUS = CLIENTS.NEW_VIDEO_STATUS;

function payloadFor(prop, value) {
  if (!prop || value == null || value === "") return null;
  switch (prop.type) {
    case "title": return { title: [{ type: "text", text: { content: String(value) } }] };
    case "rich_text": return { rich_text: [{ type: "text", text: { content: String(value) } }] };
    case "select": return { select: { name: String(value) } };
    case "status": return { status: { name: String(value) } };
    case "multi_select": return { multi_select: [{ name: String(value) }] };
    case "date": return { date: { start: String(value) } };
    default: return null;
  }
}

module.exports = async (req, res) => {
  const u = getUser(req);
  if (!u) return res.status(401).json({ error: "Not logged in" });
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!["Scriptwriter", "Ops", "COO"].includes(u.role))
    return res.status(403).json({ error: "Only the scriptwriter, Ops or COO can add videos" });
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body || "{}"); } catch { body = {}; } }
  const { client, title, type, format, postDate } = body || {};
  if (!client) return res.status(400).json({ error: "Pick a client" });
  if (!title || !title.trim()) return res.status(400).json({ error: "Give the video a title" });
  const cfg = CLIENTS.find((c) => c.name === client);
  if (!cfg) return res.status(400).json({ error: `Unknown client "${client}"` });
  const f = cfg.props;
  try {
    const db = await notion.databases.retrieve({ database_id: cfg.databaseId });
    const P = db.properties;
    const props = {};
    const set = (name, value) => { if (name && P[name]) { const pl = payloadFor(P[name], value); if (pl) props[name] = pl; } };
    set(f.title, title.trim());
    set(f.status, NEW_VIDEO_STATUS[client] || NEW_VIDEO_STATUS.default);
    if (type) set(f.type, type);
    if (format) set(f.format, format);
    if (postDate) set(f.postDate, postDate);
    if (!props[f.title]) return res.status(400).json({ error: "Couldn't map the title field for this client" });
    const page = await notion.pages.create({ parent: { database_id: cfg.databaseId }, properties: props });
    invalidate();
    return res.json({ ok: true, id: page.id });
  } catch (e) { return res.status(500).json({ error: String(e.message || e) }); }
};
