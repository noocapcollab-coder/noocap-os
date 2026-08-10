// Reads every mapped client database, normalizes each page to one shape, and
// caches for 30s so repeated dashboard loads don't hammer the Notion API.

const { Client } = require("@notionhq/client");
const CLIENTS = require("../config/clients");
const INTAKE = CLIENTS.INTAKE;
const { STATUS_MAP } = require("./statusmap");

const notion = new Client({ auth: process.env.NOTION_TOKEN });

// Canonicalize known editor-name typos on the boards to one spelling, so login
// matching, capacity, and Intake mapping line up everywhere. Jonathan's board
// spells Abhishek "ABHIISHEK"; case differences (Dmytro's "Parvez") are already
// handled by case-insensitive compares elsewhere.
const EDITOR_ALIASES = { ABHIISHEK: "ABHISHEK" };
function canonEditor(v) { if (!v) return v; return EDITOR_ALIASES[v.toUpperCase()] || v; }

function readProp(page, name) {
  if (!name) return null;
  const p = page.properties[name];
  if (!p) return null;
  switch (p.type) {
    case "title": return p.title.map((x) => x.plain_text).join("");
    case "rich_text": return p.rich_text.map((x) => x.plain_text).join("");
    case "select": return p.select ? p.select.name : null;
    case "status": return p.status ? p.status.name : null;
    case "multi_select": return p.multi_select.map((x) => x.name).join(", ") || null;
    case "people": return p.people[0] ? p.people[0].name : null;
    case "date": return p.date ? p.date.start : null;
    case "number": return p.number;
    case "url": return p.url;
    case "formula": return p.formula ? (p.formula.number ?? p.formula.string ?? p.formula.boolean ?? p.formula.date?.start ?? null) : null;
    case "last_edited_time": return p.last_edited_time;
    case "created_time": return p.created_time;
    default: return null;
  }
}

function canonicalType(type, format) {
  if (String(format || "").toUpperCase().includes("LONG")) return "Long-form";
  if (String(type || "").toUpperCase() === "SPONSOR") return "Sponsor";
  return "Personal";
}
function inferEffort(canonType) {
  return canonType === "Long-form" ? "L" : canonType === "Sponsor" ? "M" : "S";
}

function normalize(page, cfg) {
  const f = cfg.props;
  const statusRaw = readProp(page, f.status);
  const stage = STATUS_MAP[statusRaw] || "Intake";
  const type = readProp(page, f.type);
  const format = readProp(page, f.format);
  const canonType = canonicalType(type, format);
  return {
    id: page.id,
    source: "board",
    client: cfg.name,
    title: readProp(page, f.title) || "(untitled)",
    stage,
    statusRaw,
    owner: canonEditor(readProp(page, f.editor)),    // raw tag, e.g. "PARVEZ" (typos canonicalized)
    priority: readProp(page, f.priority) || "P2",
    effort: readProp(page, f.effort) || inferEffort(canonType),
    waitingOn: readProp(page, f.waitingOn),
    postDate: readProp(page, f.postDate),
    type: canonType,
    footage: readProp(page, f.footage),
    brief: readProp(page, f.brief),
    refs: readProp(page, f.refs),
    lastEdited: page.last_edited_time,           // for the "going stale" radar
  };
}

async function queryDB(cfg) {
  const out = [];
  let cursor;
  do {
    const r = await notion.databases.query({
      database_id: cfg.databaseId,
      start_cursor: cursor,
      page_size: 100,
    });
    for (const pg of r.results) out.push(normalize(pg, cfg));
    cursor = r.has_more ? r.next_cursor : null;
  } while (cursor);
  return out;
}

let cache = { at: 0, data: null };

async function fetchAllTasks(fresh) {
  if (!fresh && cache.data && Date.now() - cache.at < 30000) return cache.data;
  const all = [];
  const errors = [];
  for (const cfg of CLIENTS) {
    if (!cfg.databaseId) continue;
    try { all.push(...(await queryDB(cfg))); }
    catch (e) { errors.push(`${cfg.name}: ${e.message}`); }
  }
  cache = { at: Date.now(), data: all };
  if (errors.length) console.error("Notion read errors:", errors.join(" | "));
  return all;
}

// ---- Video Intake (editor-facing: their submitted / in-review videos) -------
function normalizeIntake(page) {
  const ip = INTAKE.props;
  const status = readProp(page, ip.status) || "In Review";
  const main = readProp(page, ip.threadMain);       // Discord Thread ID — set on nearly every row
  const changes = readProp(page, ip.threadChanges); // Changes Thread ID — set once a video hits Changes
  // Open the changes thread for a card that's actually in Changes; otherwise
  // the main discussion thread. (Editor/Video Thread ID are never written by
  // n8n, so we don't rely on them.)
  const threadId = (status === "Changes" ? (changes || main) : (main || changes)) || null;
  return {
    id: page.id,
    source: "intake",
    client: readProp(page, ip.creator),
    title: readProp(page, ip.title) || "(untitled)",
    stage: status,
    owner: readProp(page, ip.editor), // Title-case name, e.g. "Parvez"
    frame: readProp(page, ip.frame),
    type: readProp(page, ip.type),
    postDate: readProp(page, "Post Due") || readProp(page, "Posted At") || null,
    priority: readProp(page, "Priority"),
    // Metrics for the COO scorecard / cycle-time (real Notion timestamps).
    postedAt: readProp(page, "Posted At"),
    cycleHrs: readProp(page, "Total Cycle (hrs)"),
    revisions: readProp(page, "Revisions"),
    lastUpdated: readProp(page, "Last Updated"),
    threadId,
  };
}

let intakeCache = { at: 0, data: null };
async function fetchIntakeTasks(fresh) {
  if (!fresh && intakeCache.data && Date.now() - intakeCache.at < 30000) return intakeCache.data;
  const out = [];
  let cursor;
  do {
    const r = await notion.databases.query({ database_id: INTAKE.databaseId, start_cursor: cursor, page_size: 100 });
    for (const pg of r.results) out.push(normalizeIntake(pg));
    cursor = r.has_more ? r.next_cursor : null;
  } while (cursor);
  intakeCache = { at: Date.now(), data: out };
  return out;
}

function invalidate() { cache = { at: 0, data: null }; intakeCache = { at: 0, data: null }; }

module.exports = { notion, fetchAllTasks, fetchIntakeTasks, invalidate, canonEditor };
