// Read the current script off a video's Notion page (the "SCRIPT" section).
// Accepts: { pageId } -> { script }  — Scriptwriter / Ops / COO only.
const { getUser } = require("../lib/auth");
const { notion } = require("../lib/notion");

module.exports = async (req, res) => {
  const u = getUser(req);
  if (!u) return res.status(401).json({ error: "Not logged in" });
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!["Scriptwriter", "Ops", "COO"].includes(u.role))
    return res.status(403).json({ error: "Not allowed" });
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body || "{}"); } catch { body = {}; } }
  const { pageId } = body || {};
  if (!pageId) return res.status(400).json({ error: "Missing pageId" });
  try {
    const paras = [];
    let cursor, inScript = false;
    do {
      const r = await notion.blocks.children.list({ block_id: pageId, start_cursor: cursor, page_size: 100 });
      for (const b of r.results) {
        const isHeading = b.type && b.type.indexOf("heading_") === 0;
        const htext = isHeading ? (b[b.type].rich_text || []).map((x) => x.plain_text).join("") : "";
        if (inScript) {
          if (isHeading) { inScript = false; }
          else if (b.type === "paragraph") { paras.push((b.paragraph.rich_text || []).map((x) => x.plain_text).join("")); continue; }
        }
        if (!inScript && b.type === "heading_2" && htext.trim() === "SCRIPT") { inScript = true; }
      }
      cursor = r.has_more ? r.next_cursor : null;
    } while (cursor);
    return res.json({ script: paras.join("\n\n").trim() });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
};
