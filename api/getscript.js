// Read the current script off a video's Notion page so the scriptwriter can
// open, edit, and re-save it.
//
// A page can carry several sections. We recognize these headings (case-
// insensitive) and load the best one, in this priority:
//   1. SCRIPT / SCRIPT DRAFT / FINAL SCRIPT  — the actual written script
//   2. TRANSCRIPT                            — raw reference (only if no script yet)
// Everything under a section (including sub-headings like "Hook 1:", "Body:")
// is captured until the next recognized section heading, so the whole draft
// loads, not just the first block.
//
// Accepts: { pageId } -> { script, from }   — Scriptwriter / Ops / COO only.

const { getUser } = require("../lib/auth");
const { notion } = require("../lib/notion");

const SCRIPT_HEADS = ["SCRIPT", "SCRIPT DRAFT", "FINAL SCRIPT"]; // preferred, in order
const FALLBACK_HEADS = ["TRANSCRIPT"];
const RECOGNIZED = [...SCRIPT_HEADS, ...FALLBACK_HEADS];

function headingText(b) {
  const t = b.type;
  if (t && t.indexOf("heading_") === 0) return (b[t].rich_text || []).map((x) => x.plain_text).join("").trim();
  return null;
}
// Text out of any text-bearing block (paragraphs, list items, quotes, sub-headings…).
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
    const sections = {}; // recognizedHeading(upper) -> [lines]
    let cursor, current = null;
    do {
      const r = await notion.blocks.children.list({ block_id: pageId, start_cursor: cursor, page_size: 100 });
      for (const b of r.results) {
        const h = headingText(b);
        const key = h != null ? h.toUpperCase() : null;
        if (key != null && RECOGNIZED.includes(key)) {
          // Start (or switch to) a recognized section; don't capture the label itself.
          current = key;
          if (!sections[current]) sections[current] = [];
          continue;
        }
        // Any other block — including an unrecognized sub-heading — is content.
        if (current) { const txt = blockText(b); if (txt) sections[current].push(txt); }
      }
      cursor = r.has_more ? r.next_cursor : null;
    } while (cursor);

    let from = null, lines = [];
    for (const name of [...SCRIPT_HEADS, ...FALLBACK_HEADS]) {
      if (sections[name] && sections[name].join("").trim()) { from = name; lines = sections[name]; break; }
    }
    return res.json({ script: lines.join("\n\n").trim(), from });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
};
