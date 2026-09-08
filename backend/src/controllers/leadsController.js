const { query } = require("../config/db");
const { logActivity, parsePositiveInt } = require("../utils/helpers");

const STATUSES = ["new", "contacted", "qualified", "converted", "lost"];

function validateLead(body) {
  const errors = [];
  if (!body.name || !String(body.name).trim()) errors.push("Name is required");
  if (!body.phone || !String(body.phone).trim()) errors.push("Phone is required");
  return errors;
}

const SELECT = `
  SELECT l.*,
    d.name AS destination_name,
    a.full_name AS agent_name,
    c.full_name AS converted_client_name
  FROM leads l
  LEFT JOIN destinations d ON d.id = l.interested_destination_id
  LEFT JOIN agents a ON a.id = l.assigned_agent_id
  LEFT JOIN clients c ON c.id = l.converted_client_id
`;

async function list(req, res, next) {
  try {
    const page = parsePositiveInt(req.query.page, 1);
    const limit = Math.min(parsePositiveInt(req.query.limit, 10), 50);
    const offset = (page - 1) * limit;
    const q = String(req.query.q || "").trim();
    const status = req.query.status;
    const clauses = [];
    const params = [];
    if (q) {
      clauses.push("(l.name LIKE ? OR l.email LIKE ? OR l.phone LIKE ?)");
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (status && STATUSES.includes(status)) {
      clauses.push("l.status = ?");
      params.push(status);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const totalRows = await query(`SELECT COUNT(*) AS count FROM leads l ${where}`, params);
    const rows = await query(
      `${SELECT} ${where} ORDER BY l.created_at DESC LIMIT ${limit} OFFSET ${offset}`,
      params
    );
    res.json({ data: rows, total: Number(totalRows[0].count), page, limit });
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const rows = await query(`${SELECT} WHERE l.id = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: "Lead not found" });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

function values(body) {
  return [
    String(body.name).trim(),
    String(body.phone).trim(),
    body.email || null,
    body.source || null,
    body.interested_destination_id || null,
    body.budget || null,
    body.travel_date || null,
    body.travelers || 1,
    STATUSES.includes(body.status) ? body.status : "new",
    body.assigned_agent_id || null,
    body.notes || null,
  ];
}

async function create(req, res, next) {
  try {
    const errors = validateLead(req.body);
    if (errors.length) return res.status(400).json({ message: errors[0], errors });
    const result = await query(
      `INSERT INTO leads
        (name, phone, email, source, interested_destination_id, budget, travel_date, travelers, status, assigned_agent_id, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      values(req.body)
    );
    await logActivity(req.user.id, "created", "lead", result.insertId, `Lead added: ${req.body.name}`);
    const created = await query(`${SELECT} WHERE l.id = ?`, [result.insertId]);
    res.status(201).json(created[0]);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const errors = validateLead(req.body);
    if (errors.length) return res.status(400).json({ message: errors[0], errors });
    const existing = await query("SELECT id FROM leads WHERE id = ?", [req.params.id]);
    if (!existing.length) return res.status(404).json({ message: "Lead not found" });
    await query(
      `UPDATE leads SET
        name = ?, phone = ?, email = ?, source = ?, interested_destination_id = ?, budget = ?,
        travel_date = ?, travelers = ?, status = ?, assigned_agent_id = ?, notes = ?
       WHERE id = ?`,
      [...values(req.body), req.params.id]
    );
    await logActivity(req.user.id, "updated", "lead", req.params.id, `Lead updated: ${req.body.name}`);
    const rows = await query(`${SELECT} WHERE l.id = ?`, [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

async function patchStatus(req, res, next) {
  try {
    const { status, assigned_agent_id } = req.body;
    const existing = await query("SELECT id FROM leads WHERE id = ?", [req.params.id]);
    if (!existing.length) return res.status(404).json({ message: "Lead not found" });
    if (status && STATUSES.includes(status)) {
      await query("UPDATE leads SET status = ? WHERE id = ?", [status, req.params.id]);
    }
    if (assigned_agent_id !== undefined) {
      await query("UPDATE leads SET assigned_agent_id = ? WHERE id = ?", [
        assigned_agent_id || null,
        req.params.id,
      ]);
      await logActivity(req.user.id, "updated", "lead", req.params.id, "Lead assigned to agent");
    }
    const rows = await query(`${SELECT} WHERE l.id = ?`, [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

async function convert(req, res, next) {
  try {
    const rows = await query("SELECT * FROM leads WHERE id = ?", [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: "Lead not found" });
    const lead = rows[0];
    if (lead.status === "converted" && lead.converted_client_id) {
      return res.status(400).json({ message: "Lead is already converted" });
    }
    const client = await query(
      `INSERT INTO clients (full_name, phone, email, preferred_destination_id, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [lead.name, lead.phone, lead.email, lead.interested_destination_id, lead.notes]
    );
    await query("UPDATE leads SET status = 'converted', converted_client_id = ? WHERE id = ?", [
      client.insertId,
      lead.id,
    ]);
    await logActivity(req.user.id, "converted", "lead", lead.id, `Lead converted to client: ${lead.name}`);
    const updated = await query(`${SELECT} WHERE l.id = ?`, [lead.id]);
    res.json({ lead: updated[0], clientId: client.insertId });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const existing = await query("SELECT name FROM leads WHERE id = ?", [req.params.id]);
    if (!existing.length) return res.status(404).json({ message: "Lead not found" });
    await query("DELETE FROM leads WHERE id = ?", [req.params.id]);
    await logActivity(req.user.id, "deleted", "lead", Number(req.params.id), `Lead deleted: ${existing[0].name}`);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getOne, create, update, patchStatus, convert, remove };
