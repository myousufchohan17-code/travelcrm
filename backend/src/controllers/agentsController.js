const { query } = require("../config/db");
const { logActivity, uploadedImage } = require("../utils/helpers");

const SELECT = `
  SELECT a.*,
    (SELECT COUNT(*) FROM bookings b WHERE b.assigned_agent_id = a.id AND b.status <> 'cancelled') AS assigned_bookings,
    (SELECT COUNT(*) FROM leads l WHERE l.assigned_agent_id = a.id AND l.status NOT IN ('converted', 'lost')) AS assigned_leads
  FROM agents a
`;

async function list(_req, res, next) {
  try {
    const rows = await query(`${SELECT} ORDER BY a.full_name ASC`);
    res.json(
      rows.map((r) => ({
        ...r,
        assigned_bookings: Number(r.assigned_bookings),
        assigned_leads: Number(r.assigned_leads),
      }))
    );
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const rows = await query(`${SELECT} WHERE a.id = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: "Agent not found" });
    res.json({
      ...rows[0],
      assigned_bookings: Number(rows[0].assigned_bookings),
      assigned_leads: Number(rows[0].assigned_leads),
    });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { full_name, email, phone, status } = req.body;
    if (!full_name || !String(full_name).trim()) {
      return res.status(400).json({ message: "Agent name is required" });
    }
    const image = uploadedImage(req, "agents");
    const result = await query(
      "INSERT INTO agents (full_name, email, phone, status, image) VALUES (?, ?, ?, ?, ?)",
      [full_name.trim(), email || null, phone || null, status === "inactive" ? "inactive" : "active", image]
    );
    await logActivity(req.user.id, "created", "agent", result.insertId, `Agent added: ${full_name.trim()}`);
    const rows = await query(`${SELECT} WHERE a.id = ?`, [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const existing = await query("SELECT image FROM agents WHERE id = ?", [req.params.id]);
    if (!existing.length) return res.status(404).json({ message: "Agent not found" });
    const { full_name, email, phone, status } = req.body;
    if (!full_name || !String(full_name).trim()) {
      return res.status(400).json({ message: "Agent name is required" });
    }
    const image = uploadedImage(req, "agents") || existing[0].image;
    await query("UPDATE agents SET full_name = ?, email = ?, phone = ?, status = ?, image = ? WHERE id = ?", [
      full_name.trim(),
      email || null,
      phone || null,
      status === "inactive" ? "inactive" : "active",
      image,
      req.params.id,
    ]);
    const rows = await query(`${SELECT} WHERE a.id = ?`, [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const existing = await query("SELECT full_name FROM agents WHERE id = ?", [req.params.id]);
    if (!existing.length) return res.status(404).json({ message: "Agent not found" });
    await query("UPDATE bookings SET assigned_agent_id = NULL WHERE assigned_agent_id = ?", [req.params.id]);
    await query("UPDATE leads SET assigned_agent_id = NULL WHERE assigned_agent_id = ?", [req.params.id]);
    await query("UPDATE follow_ups SET assigned_agent_id = NULL WHERE assigned_agent_id = ?", [req.params.id]);
    await query("DELETE FROM agents WHERE id = ?", [req.params.id]);
    await logActivity(req.user.id, "deleted", "agent", Number(req.params.id), `Agent deleted: ${existing[0].full_name}`);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getOne, create, update, remove };
