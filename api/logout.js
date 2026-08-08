const { clearCookie } = require("../lib/auth");

module.exports = async (req, res) => {
  res.setHeader("Set-Cookie", clearCookie());
  res.json({ ok: true });
};
