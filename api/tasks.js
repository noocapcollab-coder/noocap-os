const { getUser } = require("../lib/auth");
const { fetchAllTasks, fetchIntakeTasks } = require("../lib/notion");

module.exports = async (req, res) => {
  const u = getUser(req);
  if (!u) return res.status(401).json({ error: "Not logged in" });
  try {
    res.setHeader("Cache-Control", "no-store");
    const fresh = /[?&]fresh=1/.test(req.url || "");
    // Editors see: what they must edit now (from the creator boards) + the
    // status of what they've submitted (from Video Intake).
    if (u.role === "Editor") {
      const me = (u.name || "").toLowerCase();
      const tag = (u.editorTag || "").toLowerCase();
      const isMine = (o) => { o = (o || "").toLowerCase(); return o === me || o === tag; };
      const [boards, intake] = await Promise.all([fetchAllTasks(), fetchIntakeTasks()]);
      const toEdit = boards.filter((t) => isMine(t.owner) && t.stage === "Editing");
      // Upcoming = assigned to them but still upstream (being filmed / scripted).
      const upcoming = boards.filter((t) => isMine(t.owner) && ["Ready to Edit", "Scripting", "Intake"].includes(t.stage));
      const submitted = intake.filter((t) => isMine(t.owner));
      return res.json({ user: { name: u.name, role: u.role, editorTag: u.editorTag || null }, tasks: [...toEdit, ...upcoming, ...submitted] });
    }
    // COO / Ops / Scriptwriter see the full production pipeline, plus the
    // review/changes side from Intake (for the Discord-thread links).
    const [tasks, intakeAll] = await Promise.all([fetchAllTasks(), fetchIntakeTasks()]);
    const intake = intakeAll.filter((t) => ["In Review", "Changes"].includes(t.stage));
    // Full intake (incl. posted) powers the COO cycle-time + editor scorecard.
    res.json({ user: { name: u.name, role: u.role, editorTag: u.editorTag || null }, tasks, intake, intakeAll });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
};
