const { query } = require("../config/db");
const { logActivity, parsePositiveInt } = require("../utils/helpers");

function validateClient(body) {
  const errors = [];
  if (!body.full_name || !String(body.full_name).trim()) errors.push("Full name is required");
  if (!body.phone || !String(body.phone).trim()) errors.push("Phone number is required");
  if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    errors.push("Email is invalid");
  }
  return errors;
}

async function list(req, res, next) {
  try {
    const page = parsePositiveInt(req.query.page, 1);
    const limit = Math.min(parsePositiveInt(req.query.limit, 10), 50);
    const offset = (page - 1) * limit;
    const q = String(req.query.q || "").trim();
    const where = q ? "WHERE c.full_name LIKE ? OR c.email LIKE ? OR c.phone LIKE ?" : "";
    const params = q ? [`%${q}%`, `%${q}%`, `%${q}%`] : [];
    const totalRows = await query(
      `SELECT COUNT(*) AS count FROM clients c ${where}`,
      params
    );
    const rows = await query(
      `SELECT c.*, d.name AS preferred_destination
       FROM clients c
       LEFT JOIN destinations d ON d.id = c.preferred_destination_id
       ${where}
       ORDER BY c.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );
    res.json({ data: rows, total: Number(totalRows[0].count), page, limit });
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const rows = await query(
      `SELECT c.*, d.name AS preferred_destination
       FROM clients c
       LEFT JOIN destinations d ON d.id = c.preferred_destination_id
       WHERE c.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: "Client not found" });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const errors = validateClient(req.body);
    if (errors.length) return res.status(400).json({ message: errors[0], errors });
    const {
      full_name, phone, email, address, country, preferred_destination_id, notes,
    } = req.body;
    const result = await query(
      `INSERT INTO clients (full_name, phone, email, address, country, preferred_destination_id, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        full_name.trim(),
        phone.trim(),
        email ? email.trim() : null,
        address || null,
        country || null,
        preferred_destination_id || null,
        notes || null,
      ]
    );
    await logActivity(req.user.id, "created", "client", result.insertId, `Client added: ${full_name.trim()}`);
    const created = await query("SELECT * FROM clients WHERE id = ?", [result.insertId]);
    res.status(201).json(created[0]);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const errors = validateClient(req.body);
    if (errors.length) return res.status(400).json({ message: errors[0], errors });
    const existing = await query("SELECT id FROM clients WHERE id = ?", [req.params.id]);
    if (!existing.length) return res.status(404).json({ message: "Client not found" });
    const {
      full_name, phone, email, address, country, preferred_destination_id, notes,
    } = req.body;
    await query(
      `UPDATE clients SET full_name = ?, phone = ?, email = ?, address = ?, country = ?,
       preferred_destination_id = ?, notes = ? WHERE id = ?`,
      [
        full_name.trim(),
        phone.trim(),
        email ? email.trim() : null,
        address || null,
        country || null,
        preferred_destination_id || null,
        notes || null,
        req.params.id,
      ]
    );
    await logActivity(req.user.id, "updated", "client", req.params.id, `Client updated: ${full_name.trim()}`);
    const rows = await query("SELECT * FROM clients WHERE id = ?", [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const existing = await query("SELECT full_name FROM clients WHERE id = ?", [req.params.id]);
    if (!existing.length) return res.status(404).json({ message: "Client not found" });
    await query("UPDATE bookings SET client_id = NULL WHERE client_id = ?", [req.params.id]);
    await query("DELETE FROM conversations WHERE client_id = ?", [req.params.id]);
    await query("DELETE FROM clients WHERE id = ?", [req.params.id]);
    await logActivity(
      req.user.id,
      "deleted",
      "client",
      Number(req.params.id),
      `Client deleted: ${existing[0].full_name}`
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getOne, create, update, remove };
