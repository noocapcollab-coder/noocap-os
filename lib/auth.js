// Tiny stateless auth: a signed cookie holding {name, role, editorTag, exp}.
// No database needed. Uses AUTH_SECRET to sign; tampering invalidates the cookie.

const crypto = require("crypto");
const SECRET = process.env.AUTH_SECRET || "dev-insecure-secret-change-me";
const TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  return `${body}.${mac}`;
}

function verify(token) {
  try {
    if (!token || !token.includes(".")) return null;
    const [body, mac] = token.split(".");
    const expected = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
    const a = Buffer.from(mac), b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch { return null; }
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  const out = {};
  header.split(";").forEach((c) => {
    const i = c.indexOf("=");
    if (i > -1) out[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim());
  });
  return out;
}

function getUser(req) {
  return verify(parseCookies(req).session);
}

function sessionCookie(payload) {
  const token = sign({ ...payload, exp: Date.now() + TTL_MS });
  return `session=${token}; HttpOnly; Path=/; Max-Age=${TTL_MS / 1000}; SameSite=Lax; Secure`;
}

function clearCookie() {
  return "session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax; Secure";
}

module.exports = { sign, verify, getUser, sessionCookie, clearCookie };
