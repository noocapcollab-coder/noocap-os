// Write a field back to a Notion page.
//   COO / Ops : owner, priority, effort, waitingOn, status on any video.
//   Editor    : status or waitingOn, only on their own videos.
// Assigning an owner ALSO flips Status to "7- In Edit" so your n8n editor
// Discord ping fires. Accepts: { pageId, client, field, value }

const { getUser } = require("../lib/auth");
const { notion, invalidate, canonEditor } = require("../lib/notion");
const CLIENTS = require("../config/clients");
const ASSIGN_STATUS = CLIENTS.ASSIGN_STATUS;
const INTAKE = CLIENTS.INTAKE;
// The Video Intake "Status" select options (drives your n8n Discord flow).
const INTAKE_STATUSES = ["Assigned", "Editing", "In Review", "Changes", "To Post", "Posted"];

function ownerOf(page, prop) {
  const p = prop && page.properties[prop];
  if (!p) return null;
  if (p.type === "select") return p.select ? p.select.name : null;
  if (p.type === "people") return p.people[0] ? p.people[0].name : null;
  if (p.type === "rich_text") return p.rich_text.map((x) => x.plain_text).join("");
  return null;
}

// Build the right value shape for a "named option" property (select or status).
function namedPayload(page, propName, value) {
  const p = page.properties[propName];
  const type = p ? p.type : "select";
  if (type === "people") return null; // can't set a people field by name
  if (value === null) return type === "status" ? { status: null } : { select: null };
  return type === "status" ? { status: { name: value } } : { select: { name: value } };
}

module.exports = async (req, res) => {
  const u = getUser(req);
  if (!u) return res.status(401).json({ error: "Not logged in" });
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body || "{}"); } catch { body = {}; } }
  const { pageId, client, field, value, source, action } = body || {};
  if (!pageId) return res.status(400).json({ error: "Missing pageId" });

  // ---- Remove from dashboard (COO/Ops only) --------------------------------
  // Board videos: set the board's Archive status — the page stays in Notion,
  // it just leaves every dashboard view (reversible by changing status back).
  // Intake rows have no Archive status, so those fall back to Notion trash.
  if (action === "remove" || action === "delete") {
    if (!["COO", "Ops", "Scriptwriter"].includes(u.role))
      return res.status(403).json({ error: "Only the scriptwriter, Ops or COO can remove videos" });
    try {
      const cfg = client && CLIENTS.find((c) => c.name === client);
      const av = cfg && CLIENTS.ARCHIVE_STATUS[client];
      if (cfg && cfg.props.status && av && action === "remove") {
        const page = await notion.pages.retrieve({ page_id: pageId });
        await notion.pages.update({ page_id: pageId, properties: { [cfg.props.status]: namedPayload(page, cfg.props.status, av) } });
      } else {
        await notion.pages.update({ page_id: pageId, archived: true }); // intake / fallback
      }
      invalidate();
      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: String(e.message || e) });
    }
  }

  // ---- Video Intake status move (Ops/COO drive Changes / To Post) ----------
  // Writing the Intake Status is what fires your n8n Discord automation, so
  // this is how "Send to Changes" / "Approve → To Post" light up the thread.
  if (source === "intake") {
    if (!["COO", "Ops"].includes(u.role))
      return res.status(403).json({ error: "Only Ops or COO can move review items" });
    // Intake rows have no Archive status, so a "remove" (archive/empty value, or
    // an explicit remove/delete action) trashes the page instead of erroring.
    const wantsRemove = action === "remove" || action === "delete" || !value || /^archived?$/i.test(String(value));
    try {
      if (wantsRemove) {
        await notion.pages.update({ page_id: pageId, archived: true });
      } else {
        if (!INTAKE_STATUSES.includes(value))
          return res.status(400).json({ error: "Unknown intake status" });
        await notion.pages.update({ page_id: pageId, properties: { [INTAKE.props.status]: { select: { name: value } } } });
      }
      invalidate();
      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: String(e.message || e) });
    }
  }

  if (!client || !field) return res.status(400).json({ error: "Missing client or field" });

  const cfg = CLIENTS.find((c) => c.name === client);
  if (!cfg) return res.status(400).json({ error: "Unknown client" });
  const f = cfg.props;

  let page;
  try { page = await notion.pages.retrieve({ page_id: pageId }); }
  catch (e) { return res.status(500).json({ error: String(e.message || e) }); }

  const isManager = ["COO", "Ops"].includes(u.role);
  if (!isManager) {
    if (u.role !== "Editor") return res.status(403).json({ error: "Your role is read-only" });
    if (!["status", "waitingOn"].includes(field))
      return res.status(403).json({ error: "Editors can only update status or flag blocked" });
    const owner = canonEditor(ownerOf(page, f.editor));
    if ((owner || "").toUpperCase() !== (u.editorTag || "").toUpperCase())
      return res.status(403).json({ error: "That video isn't assigned to you" });
  }

  const props = {};
  if (field === "owner") {
    const ep = namedPayload(page, f.editor, value);
    if (!ep) return res.status(400).json({ error: "Editor field is a people-type; assign it in Notion" });
    props[f.editor] = ep;
    if (f.status) props[f.status] = namedPayload(page, f.status, ASSIGN_STATUS); // fires editor Discord ping
  } else {
    const propName = { priority: f.priority, effort: f.effort, waitingOn: f.waitingOn, status: f.status }[field];
    if (!propName) return res.status(400).json({ error: `This client has no '${field}' field mapped` });
    props[propName] = namedPayload(page, propName, value);
  }

  try {
    await notion.pages.update({ page_id: pageId, properties: props });
    invalidate();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
};
