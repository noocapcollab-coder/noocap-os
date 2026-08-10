// Save (or replace) a script onto the video's Notion page body under "SCRIPT".
// Re-saving REPLACES the previous script. Accepts: { pageId, script }
const { getUser } = require("../lib/auth");
const { notion, invalidate } = require("../lib/notion");

function toBlocks(script) {
  const paras = String(script).replace(/\r/g, "").split(/\n\n+/);
  const blocks = [{ object: "block", type: "heading_2", heading_2: { rich_text: [{ type: "text", text: { content: "SCRIPT" } }] } }];
  for (const para of paras) {
    let text = para.trim();
    if (!text) continue;
    while (text.length > 1900) {
      blocks.push({ object: "block", type: "paragraph", paragraph: { rich_text: [{ type: "text", text: { content: text.slice(0, 1900) } }] } });
      text = text.slice(1900);
    }
    blocks.push({ object: "block", type: "paragraph", paragraph: { rich_text: [{ type: "text", text: { content: text } }] } });
  }
  return blocks;
}

async function clearOldScript(pageId) {
  const toDelete = [];
  let cursor, inScript = false;
  do {
    const r = await notion.blocks.children.list({ block_id: pageId, start_cursor: cursor, page_size: 100 });
    for (const b of r.results) {
      const isHeading = b.type && b.type.indexOf("heading_") === 0;
      const text = isHeading ? (b[b.type].rich_text || []).map((x) => x.plain_text).join("") : "";
      if (inScript) {
        if (isHeading) { inScript = false; }
        else { toDelete.push(b.id); continue; }
      }
      if (!inScript && b.type === "heading_2" && text.trim() === "SCRIPT") { inScript = true; toDelete.push(b.id); }
    }
    cursor = r.has_more ? r.next_cursor : null;
  } while (cursor);
  for (const id of toDelete) { try { await notion.blocks.delete({ block_id: id }); } catch (e) {} }
}

module.exports = async (req, res) => {
  const u = getUser(req);
  if (!u) return res.status(401).json({ error: "Not logged in" });
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!["Scriptwriter", "Ops", "COO"].includes(u.role))
    return res.status(403).json({ error: "Only the scriptwriter, Ops or COO can save scripts" });
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body || "{}"); } catch { body = {}; } }
  const { pageId, script } = body || {};
  if (!pageId) return res.status(400).json({ error: "Missing pageId" });
  if (!script || !script.trim()) return res.status(400).json({ error: "Paste the script first" });
  try {
    await clearOldScript(pageId);
    await notion.blocks.children.append({ block_id: pageId, children: toBlocks(script).slice(0, 100) });
    invalidate();
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
};
