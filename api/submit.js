// "Submit for review" — the editor's one-tap handoff.
// Creates a row in the Video Intake database (which fires your n8n handoff /
// Discord flow) and advances the source card past Editing so it leaves the
// editor's queue. Accepts: { pageId, client, frame }

const { getUser } = require("../lib/auth");
const { notion, invalidate, canonEditor } = require("../lib/notion");
const CLIENTS = require("../config/clients");
const INTAKE = CLIENTS.INTAKE;
const REVIEW_STATUS = CLIENTS.REVIEW_STATUS;

function readTitle(page, prop) {
  const p = page.properties[prop];
  return p && p.type === "title" ? p.title.map((x) => x.plain_text).join("") : "";
}
function readNamed(page, prop) {
  const p = prop && page.properties[prop];
  if (!p) return null;
  if (p.type === "select") return p.select ? p.select.name : null;
  if (p.type === "status") return p.status ? p.status.name : null;
  if (p.type === "people") return p.people[0] ? p.people[0].name : null;
  return null;
}
function namedPayload(page, propName, value) {
  const type = page.properties[propName] ? page.properties[propName].type : "select";
  return type === "status" ? { status: { name: value } } : { select: { name: value } };
}

module.exports = async (req, res) => {
  const u = getUser(req);
  if (!u) return res.status(401).json({ error: "Not logged in" });
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body || "{}"); } catch { body = {}; } }
  const { pageId, client, frame } = body || {};
  if (!pageId || !client) return res.status(400).json({ error: "Missing pageId or client" });
  if (!frame) return res.status(400).json({ error: "A Frame.io link is required to submit" });

  const cfg = CLIENTS.find((c) => c.name === client);
  if (!cfg) return res.status(400).json({ error: "Unknown client" });

  let page;
  try { page = await notion.pages.retrieve({ page_id: pageId }); }
  catch (e) { return res.status(500).json({ error: String(e.message || e) }); }

  const ownerTag = (canonEditor(readNamed(page, cfg.props.editor)) || "").toUpperCase();
  if (u.role === "Editor" && ownerTag !== (u.editorTag || "").toUpperCase())
    return res.status(403).json({ error: "That video isn't assigned to you" });

  const title = readTitle(page, cfg.props.title) || "Untitled";
  const typeRaw = (readNamed(page, cfg.props.type) || "").toUpperCase();
  const isSponsor = typeRaw === "SPONSOR";
  const creatorName = INTAKE.creatorMap[client] || client;
  const editorName = INTAKE.editorMap[ownerTag] || (ownerTag ? ownerTag[0] + ownerTag.slice(1).toLowerCase() : null);

  const ip = INTAKE.props;
  const intakeProps = {
    [ip.title]: { title: [{ text: { content: title } }] },
    [ip.creator]: { select: { name: creatorName } },
    [ip.type]: { select: { name: isSponsor ? "SPONSOR" : "PERSONAL" } },
    [ip.frame]: { url: frame },
    [ip.status]: { select: { name: INTAKE.submitStatus } },
  };
  if (editorName) intakeProps[ip.editor] = { select: { name: editorName } };

  try {
    await notion.pages.create({ parent: { database_id: INTAKE.databaseId }, properties: intakeProps });
    // Move the source card out of the editor's queue.
    if (cfg.props.status) {
      await notion.pages.update({ page_id: pageId, properties: { [cfg.props.status]: namedPayload(page, cfg.props.status, REVIEW_STATUS) } });
    }
    invalidate();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
};
