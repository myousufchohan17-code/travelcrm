const { query } = require("../config/db");

async function attachWorkspace(req, _res, next) {
  try {
    const rows = await query(
      "SELECT id, full_name, email, role, avatar, phone FROM users ORDER BY id ASC LIMIT 1"
    );
    req.user = rows[0] || { id: null, full_name: "Travel Manager", email: null, role: "admin", avatar: null, phone: null };
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { attachWorkspace };
