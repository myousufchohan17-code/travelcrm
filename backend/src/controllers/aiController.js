const { fallbackAnswer } = require("../services/aiFallback");

const MAX_MESSAGE = 2000;
const hits = new Map();

function rateLimited(req) {
  const key = req.ip || "local";
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((time) => now - time < 60_000);
  if (recent.length >= 30) { hits.set(key, recent); return true; }
  recent.push(now); hits.set(key, recent); return false;
}

async function chat(req, res) {
  if (!req.user) return res.status(401).json({ message: "You must be signed in to use the assistant." });
  if (rateLimited(req)) return res.status(429).json({ message: "Too many questions. Please wait a moment and try again." });
  const message = String(req.body?.message || "").trim();
  if (!message) return res.status(400).json({ message: "Please enter a question." });
  if (message.length > MAX_MESSAGE) return res.status(400).json({ message: "Please shorten your question." });
  try {
    // Local-only rules engine: reads authorized CRM records and makes no external AI request.
    return res.json({ reply: await fallbackAnswer(message) });
  } catch (_err) {
    return res.json({ reply: "I couldn't access the required CRM information. Please try again." });
  }
}

module.exports = { chat };
