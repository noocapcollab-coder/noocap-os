// Read the current script off a video's Notion page so the scriptwriter can
// open, edit, and re-save it. Prefers a "SCRIPT" section (what the dashboard
// writes); falls back to a "TRANSCRIPT" section (what the scripting workflow
// writes), so an existing script always shows in the box.
// Accepts: { pageId } -> { script, from }   — Scriptwriter / Ops / COO only.

const { getUser } = require("../lib/auth");
const { notion } = require("../lib/notion");

// Headings we treat as a script section, in priority order.
const SECTION_HEADS = ["SCRIPT", "TRANSCRIPT"];

function headingText(b) {
  const t = b.type;
  if (t && t.indexOf("heading_") === 0) return (b[t].rich_text || []).map((x) => x.plain_text).join("").trim();
  return null;
}
// Pull readable text out of any text-bearing block (paragraphs, list items, quotes…).
function blockText(b) {
  const t = b.type;
  const node = b[t];
  const rt = node && node.rich_text;
  if (Array.isArray(rt)) return rt.map((x) => x.plain_text).join("");
  return "";
}

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
    // Collect the text under each recognized section heading.
    const sections = {}; // headingName(upper) -> [lines]
    let cursor, current = null;
    do {
      const r = await notion.blocks.children.list({ block_id: pageId, start_cursor: cursor, page_size: 100 });
      for (const b of r.results) {
        const h = headingText(b);
        if (h !== null) {
          const key = h.toUpperCase();
          current = SECTION_HEADS.includes(key) ? key : null;
          if (current && !sections[current]) sections[current] = [];
          continue;
        }
        if (current) {
          const txt = blockText(b);
          if (txt) sections[current].push(txt);
        }
      }
      cursor = r.has_more ? r.next_cursor : null;
    } while (cursor);

    let from = null, lines = [];
    for (const name of SECTION_HEADS) {
      if (sections[name] && sections[name].join("").trim()) { from = name; lines = sections[name]; break; }
    }
    return res.json({ script: lines.join("\n\n").trim(), from });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
};
