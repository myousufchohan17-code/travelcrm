const { query } = require("../config/db");
const { uploadedImage } = require("../utils/helpers");

async function me(req, res, next) {
  try {
    if (!req.user?.id) {
      return res.json({
        id: null,
        full_name: "Travel Manager",
        email: null,
        role: "admin",
        avatar: null,
        phone: null,
      });
    }
    const rows = await query(
      "SELECT id, full_name, email, role, avatar, phone, created_at FROM users WHERE id = ?",
      [req.user.id]
    );
    res.json(rows[0] || req.user);
  } catch (err) {
    next(err);
  }
}

async function updateProfile(req, res, next) {
  try {
    const { full_name, phone, email } = req.body;
    if (!full_name) {
      return res.status(400).json({ message: "Full name is required" });
    }
    const avatar = uploadedImage(req, "avatars") || undefined;
    let userId = req.user?.id;

    if (!userId) {
      const created = await query(
        `INSERT INTO users (full_name, email, password_hash, role, phone, avatar)
         VALUES (?, ?, '', 'admin', ?, ?)`,
        [full_name.trim(), email ? String(email).trim() : null, phone || null, avatar || null]
      );
      userId = created.insertId;
    } else if (avatar) {
      await query("UPDATE users SET full_name = ?, phone = ?, email = ?, avatar = ? WHERE id = ?", [
        full_name.trim(),
        phone || null,
        email ? String(email).trim() : null,
        avatar,
        userId,
      ]);
    } else {
      await query("UPDATE users SET full_name = ?, phone = ?, email = ? WHERE id = ?", [
        full_name.trim(),
        phone || null,
        email ? String(email).trim() : null,
        userId,
      ]);
    }

    const rows = await query(
      "SELECT id, full_name, email, role, avatar, phone FROM users WHERE id = ?",
      [userId]
    );
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

module.exports = { me, updateProfile };
