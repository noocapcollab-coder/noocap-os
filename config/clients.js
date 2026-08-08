// ============================================================================
// PER-CLIENT MAPPING
// Each client's Notion content database has different property names, so we map
// them to one canonical shape here. Add a client by filling in its databaseId
// and the Notion property names for each field. Set a field to null if that
// client's database doesn't have it (the app falls back sensibly).
//
// databaseId = the Notion database's block id (32 hex chars, no dashes needed).
//   Find it: open the database as a full page in Notion → copy the URL →
//   it's the long id before "?v=". Share the DB with your integration.
//
// editorKind = "select" (a dropdown of names) or "people" (Notion members).
// ============================================================================

module.exports = [
  // ---- FULLY MAPPED (verified) --------------------------------------------
  {
    name: "Valeri",
    databaseId: "64cfc161e6254330a25381fda0118a2c",
    editorKind: "select",
    props: {
      title: "Video",
      status: "Status",
      editor: "Editor",
      priority: "Priority",
      effort: "Effort",
      waitingOn: "Waiting On",
      postDate: "Post Date",
      type: "Type",
      format: "Format",
      footage: "Raw Footage",
      brief: "Brief",
      refs: "Ref Video",
    },
  },
  {
    name: "Chris",
    databaseId: "2a1508e99dda81698188c34e5ac3f4f5",
    editorKind: "select",
    props: {
      title: "Video Title",
      status: "Status",
      editor: "EDITOR",
      priority: "Priority",
      effort: "Effort",
      waitingOn: "Waiting On",
      postDate: "DUE DATE",
      type: "TYPE",
      format: "Format",
      footage: "Raw Footage",
      brief: "Brief",
      refs: "Ref",
    },
  },
  {
    name: "Brad",
    databaseId: "28b508e99dda81738029ce0e348a06be",
    editorKind: "select",
    props: {
      title: "VIDEO",
      status: "Status",
      editor: "Editor",
      priority: null,     // add a "Priority" select in Brad's DB to enable
      effort: null,       // add an "Effort" select to enable capacity math
      waitingOn: null,    // add a "Waiting On" select to enable blocked signals
      postDate: "Date",
      type: "TYPE",       // select PERSONAL/SPONSOR (board also has a separate multi-select "Type")
      format: null,
      footage: "Raw Footage",
      brief: "Brief ",
      refs: "Ref video",
    },
  },

  // ---- MAPPED FROM LIVE BOARDS (property names verified per board) ---------
  // These boards share the numbered Status flow but each names its columns
  // differently, so every "props" entry below is the board's own spelling.
  // None of them carry Priority / Effort / Waiting On yet, so those are null.
  {
    name: "Lindsay",
    databaseId: "301508e99dda81afaca1c218fb551b46",
    editorKind: "select",
    props: {
      title: "Video Title",
      status: "Status",        // status-type field
      editor: "Editor",
      priority: null,
      effort: null,
      waitingOn: null,
      postDate: "DUE DATE",
      type: "Type",            // multi-select (PERSONAL / SPONSOR)
      format: "FORMAT",        // SHORT FORM / LONG FORM
      footage: "Raw Footage",
      brief: "Brief",
      refs: "REF",
    },
  },
  {
    name: "EmTech",
    databaseId: "328508e99dda802bb543d2871feaad8c",
    editorKind: "select",
    props: {
      title: "VIDEO",
      status: "Status",        // status-type field
      editor: "EDITOR",
      priority: null,
      effort: null,
      waitingOn: null,
      postDate: "DUE DATE",
      type: "TYPE",
      format: null,
      footage: "Raw Footage",
      brief: "BREIF",          // board spells it "BREIF" — matched intentionally
      refs: "Ref Video",
    },
  },
  {
    name: "Duncan",
    databaseId: "328508e99dda800a939af88618098413",
    editorKind: "select",
    props: {
      title: "VIDEO",
      status: "Status",        // status-type field
      editor: "EDITOR",
      priority: null,
      effort: null,
      waitingOn: null,
      postDate: "DUE DATE",
      type: "TYPE",
      format: null,
      footage: "Raw Footage",
      brief: "BRIEF",
      refs: "Ref Video",
    },
  },
  {
    name: "Dmytro",
    databaseId: "36b508e99dda8002a2f6f80361247c48",
    editorKind: "select",
    props: {
      title: "Video",
      status: "Status",        // select-type field
      editor: "Editor",
      priority: null,
      effort: null,
      waitingOn: null,
      postDate: "Post Date",
      type: "Type",
      format: null,
      footage: "Raw Footage",
      brief: null,             // board has no brief/script field
      refs: "Ref Video",
    },
  },
  {
    name: "Jonathan",
    databaseId: "b83508e99dda821997b08146629ef81a",
    editorKind: "select",
    props: {
      title: "VIDEO",
      status: "STATUS",        // select-type field, ALL-CAPS name
      editor: "EDITOR",
      priority: null,
      effort: null,
      waitingOn: null,
      postDate: "POST DATE",
      type: "TYPE",
      format: "FORMAT",
      footage: "RAW FOOTAGE",
      brief: null,             // board has no brief/script field
      refs: "REF VIDEO",
    },
  },
];

// ============================================================================
// VIDEO INTAKE (the "video is ready" handoff form that fires your n8n Discord
// flow). "Submit for review" in the dashboard creates a row here.
// creatorMap/editorMap translate the dashboard's names to Intake's exact option
// spellings (note: "Valeri" board -> "Valerie" in Intake).
// ============================================================================
// Your Discord server (guild) ID — used to build thread deep-links.
module.exports.DISCORD_SERVER_ID = "1406306400006705162";

module.exports.INTAKE = {
  databaseId: "12f9e8e39dc34b07aed85f277c58619c",
  props: { title: "Video Title", creator: "Creator", editor: "Editor", type: "TYPE", frame: "Frame.io Link", status: "Status", format: "Format",
    threadChanges: "Changes Thread ID", threadMain: "Discord Thread ID", threadEditor: "Editor Thread ID", threadVideo: "Video Thread ID", threadPost: "Post Thread ID" },
  submitStatus: "In Review", // status the new Intake row gets on submit
  creatorMap: { Valeri: "Valerie", Chris: "Chris", Brad: "Brad", Lindsay: "Lindsay", Duncan: "Duncan", EmTech: "EmTech", Jonathan: "Jonathan", Dmytro: "Dmytro", Joshua: "Joshua" },
  editorMap: { PARVEZ: "Parvez", SUMITH: "Sumith", VICKY: "Vicky", ABHISHEK: "Abhishek", PRABAL: "Prabal", UTSAV: "Utsav" },
};

// Status the assign action writes on the creator board to fire the editor's
// Discord ping (your automation triggers on Editor set + this status).
module.exports.ASSIGN_STATUS = "7- In Edit";
// Status the source card moves to after an editor submits for review.
module.exports.REVIEW_STATUS = "9- Approval Brand/Creator";

