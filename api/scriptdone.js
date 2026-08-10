// Mark a script done: move the video to "5- Script Approval" on its board.
// Accepts: { pageId, client }
// Scriptwriter / Ops / COO only.

const { getUser } = require("../lib/auth");
const { notion, invalidate, findStatusOption } = require("../lib/notion");
const CLIENTS = require("../config/clients");
const APPROVAL = CLIENTS.SCRIPT_APPROVAL_STATUS;

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
    return res.status(403).json({ error: "Only the scriptwriter, Ops or COO can mark scripts done" });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body || "{}"); } catch { body = {}; } }
  const { pageId, client } = body || {};
  if (!pageId) return res.status(400).json({ error: "Missing pageId" });
  if (!client) return res.status(400).json({ error: "Missing client" });

  const cfg = CLIENTS.find((c) => c.name === client);
  if (!cfg || !cfg.props.status) return res.status(400).json({ error: `No status field mapped for "${client}"` });

  try {
    // Use the board's real "5- Script Approval …" option (names vary per board),
    // falling back to the configured label if the option lookup finds nothing.
    const label = (await findStatusOption(cfg.databaseId, cfg.props.status, /^\s*5\b/)) || APPROVAL[client] || APPROVAL.default;
    const page = await notion.pages.retrieve({ page_id: pageId });
    await notion.pages.update({ page_id: pageId, properties: { [cfg.props.status]: namedPayload(page, cfg.props.status, label) } });
    invalidate();
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
};
