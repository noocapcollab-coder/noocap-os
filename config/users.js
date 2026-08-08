// ============================================================================
// USERS + ACCESS CODES
// Each person logs in with a 4-digit code. Roles decide what they see:
//   COO / Ops / Scriptwriter  -> see all clients
//   Editor                    -> sees ONLY their own videos (matched by editorTag)
//
// editorTag MUST match the exact editor value used in Notion (usually UPPERCASE).
// Change the codes before going live. These live server-side only (never sent
// to the browser), so plain codes are fine for an internal tool.
// ============================================================================

module.exports = [
  { name: "Harsh",  role: "COO",          code: "4471" },
  { name: "Priya",  role: "Ops",          code: "2208" },
  { name: "Nisha",  role: "Scriptwriter", code: "3310" },

  { name: "Parvez",   role: "Editor", editorTag: "PARVEZ",   code: "1120" },
  { name: "Vicky",    role: "Editor", editorTag: "VICKY",    code: "5502" },
  { name: "Sumith",   role: "Editor", editorTag: "SUMITH",   code: "7789" },
  { name: "Abhishek", role: "Editor", editorTag: "ABHISHEK", code: "6614" },
  { name: "Prabal",   role: "Editor", editorTag: "PRABAL",   code: "9903" },
];
