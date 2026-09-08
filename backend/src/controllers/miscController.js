const { query } = require("../config/db");

async function list(req, res, next) {
  try {
    const rows = await query(
      `SELECT * FROM notifications
       ORDER BY created_at DESC
       LIMIT 30`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function unreadCount(req, res, next) {
  try {
    const rows = await query(
      `SELECT COUNT(*) AS count FROM notifications WHERE is_read = 0`
    );
    res.json({ count: Number(rows[0].count) });
  } catch (err) {
    next(err);
  }
}

async function markRead(req, res, next) {
  try {
    await query("UPDATE notifications SET is_read = 1 WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function markAllRead(req, res, next) {
  try {
    await query("UPDATE notifications SET is_read = 1");
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function activities(_req, res, next) {
  try {
    const rows = await query(
      `SELECT a.*, u.full_name AS user_name
       FROM activities a
       LEFT JOIN users u ON u.id = a.user_id
       ORDER BY a.created_at DESC
       LIMIT 20`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function getSettings(_req, res, next) {
  try {
    const rows = await query("SELECT * FROM settings WHERE id = 1");
    res.json(rows[0] || { company_name: "SkyTrail Travels", logo: null });
  } catch (err) {
    next(err);
  }
}

async function updateSettings(req, res, next) {
  try {
    const { company_name } = req.body;
    if (!company_name || !String(company_name).trim()) {
      return res.status(400).json({ message: "Company name is required" });
    }
    await query("UPDATE settings SET company_name = ? WHERE id = 1", [company_name.trim()]);
    const rows = await query("SELECT * FROM settings WHERE id = 1");
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  unreadCount,
  markRead,
  markAllRead,
  activities,
  getSettings,
  updateSettings,
};
