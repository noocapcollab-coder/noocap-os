// Pull a video back to scripting (undo an accidental "send for approval").
// Sets status to "4- Script Draft". Accepts: { pageId, client } — Scriptwriter / Ops / COO.
const { getUser } = require("../lib/auth");
const { notion, invalidate } = require("../lib/notion");
const CLIENTS = require("../config/clients");
const BACK = CLIENTS.BACK_TO_SCRIPT_STATUS;

function namedPayload(page, propName, value) {
  const p = page.properties[propName];
  const type = p ? p.type : "select";
  return type === "status" ? { status: { name: value } } : { select: { name: value } };
}

module.exports = async (req, res) => {
  const u = getUser(req);
  if (!u) return res.status(401).json({ error: "Not logged in" });
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!["Scriptwriter", "Ops", "COO"].includes(u.role))
    return res.status(403).json({ error: "Only the scriptwriter, Ops or COO can pull a script back" });
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body || "{}"); } catch { body = {}; } }
  const { pageId, client } = body || {};
  if (!pageId) return res.status(400).json({ error: "Missing pageId" });
  if (!client) return res.status(400).json({ error: "Missing client" });
  const cfg = CLIENTS.find((c) => c.name === client);
  if (!cfg || !cfg.props.status) return res.status(400).json({ error: `No status field mapped for "${client}"` });
  const label = BACK[client] || BACK.default;
  try {
    const page = await notion.pages.retrieve({ page_id: pageId });
    await notion.pages.update({ page_id: pageId, properties: { [cfg.props.status]: namedPayload(page, cfg.props.status, label) } });
    invalidate();
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
};
