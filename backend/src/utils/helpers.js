const { query } = require("../config/db");

async function logActivity(userId, action, entityType, entityId, description) {
  await query(
    `INSERT INTO activities (user_id, action, entity_type, entity_id, description)
     VALUES (?, ?, ?, ?, ?)`,
    [userId || null, action, entityType, entityId || null, description]
  );
}

async function notify(userId, title, body, type = "info", link = null) {
  await query(
    `INSERT INTO notifications (user_id, title, body, type, link)
     VALUES (?, ?, ?, ?, ?)`,
    [userId || null, title, body, type, link]
  );
}

function pctChange(current, previous) {
  const cur = Number(current) || 0;
  const prev = Number(previous) || 0;
  if (prev === 0) return null;
  return Math.round(((cur - prev) / prev) * 1000) / 10;
}

function publicFileUrl(filename, folder) {
  if (!filename) return null;
  if (filename.startsWith("http") || filename.startsWith("/uploads/") || filename.startsWith("data:")) {
    return filename;
  }
  return `/uploads/${folder}/${filename}`;
}

function uploadedImage(req, folder) {
  if (!req?.file) return null;
  if (req.file.buffer) {
    const mime = req.file.mimetype || "image/jpeg";
    return `data:${mime};base64,${req.file.buffer.toString("base64")}`;
  }
  return `/uploads/${folder}/${req.file.filename}`;
}

function parsePositiveInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

module.exports = {
  logActivity,
  notify,
  pctChange,
  publicFileUrl,
  parsePositiveInt,
  uploadedImage,
};
