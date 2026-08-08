const users = require("../config/users");
const { sessionCookie } = require("../lib/auth");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body || "{}"); } catch { body = {}; } }
  const code = ((body && body.code) || "").toString().trim();
  const u = users.find((x) => x.code === code);
  if (!u) return res.status(401).json({ error: "That code doesn't match anyone." });
  res.setHeader("Set-Cookie", sessionCookie({ name: u.name, role: u.role, editorTag: u.editorTag || null }));
  res.json({ name: u.name, role: u.role });
};
