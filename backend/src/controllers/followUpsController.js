const { query } = require("../config/db");
const { logActivity, parsePositiveInt } = require("../utils/helpers");

const STATUSES = ["scheduled", "completed", "cancelled", "rescheduled"];

function validate(body) {
  const errors = [];
  if (!body.follow_up_date) errors.push("Date is required");
  if (!body.client_id && !body.lead_id) errors.push("Lead or client is required");
  return errors;
}

const SELECT = `
  SELECT f.*,
    c.full_name AS client_name,
    l.name AS lead_name,
    a.full_name AS agent_name
  FROM follow_ups f
  LEFT JOIN clients c ON c.id = f.client_id
  LEFT JOIN leads l ON l.id = f.lead_id
  LEFT JOIN agents a ON a.id = f.assigned_agent_id
`;

async function list(req, res, next) {
  try {
    const page = parsePositiveInt(req.query.page, 1);
    const limit = Math.min(parsePositiveInt(req.query.limit, 10), 50);
    const offset = (page - 1) * limit;
    const status = req.query.status;
    const clauses = [];
    const params = [];
    if (status && STATUSES.includes(status)) {
      clauses.push("f.status = ?");
      params.push(status);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const totalRows = await query(`SELECT COUNT(*) AS count FROM follow_ups f ${where}`, params);
    const rows = await query(
      `${SELECT} ${where} ORDER BY f.follow_up_date ASC, f.follow_up_time ASC LIMIT ${limit} OFFSET ${offset}`,
      params
    );
    res.json({ data: rows, total: Number(totalRows[0].count), page, limit });
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const rows = await query(`${SELECT} WHERE f.id = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: "Follow-up not found" });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

function values(body) {
  return [
    body.client_id || null,
    body.lead_id || null,
    body.follow_up_date,
    body.follow_up_time || null,
    body.type || "call",
    body.notes || null,
    body.assigned_agent_id || null,
    STATUSES.includes(body.status) ? body.status : "scheduled",
  ];
}

async function create(req, res, next) {
  try {
    const errors = validate(req.body);
    if (errors.length) return res.status(400).json({ message: errors[0], errors });
    const result = await query(
      `INSERT INTO follow_ups (client_id, lead_id, follow_up_date, follow_up_time, type, notes, assigned_agent_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      values(req.body)
    );
    await logActivity(req.user.id, "created", "follow_up", result.insertId, "Follow-up scheduled");
    const created = await query(`${SELECT} WHERE f.id = ?`, [result.insertId]);
    res.status(201).json(created[0]);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const errors = validate(req.body);
    if (errors.length) return res.status(400).json({ message: errors[0], errors });
    const existing = await query("SELECT id FROM follow_ups WHERE id = ?", [req.params.id]);
    if (!existing.length) return res.status(404).json({ message: "Follow-up not found" });
    await query(
      `UPDATE follow_ups SET client_id = ?, lead_id = ?, follow_up_date = ?, follow_up_time = ?,
       type = ?, notes = ?, assigned_agent_id = ?, status = ? WHERE id = ?`,
      [...values(req.body), req.params.id]
    );
    await logActivity(req.user.id, "updated", "follow_up", req.params.id, "Follow-up updated");
    const rows = await query(`${SELECT} WHERE f.id = ?`, [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

async function complete(req, res, next) {
  try {
    const existing = await query("SELECT id FROM follow_ups WHERE id = ?", [req.params.id]);
    if (!existing.length) return res.status(404).json({ message: "Follow-up not found" });
    await query("UPDATE follow_ups SET status = 'completed' WHERE id = ?", [req.params.id]);
    await logActivity(req.user.id, "updated", "follow_up", req.params.id, "Follow-up completed");
    const rows = await query(`${SELECT} WHERE f.id = ?`, [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

async function reschedule(req, res, next) {
  try {
    const { follow_up_date, follow_up_time } = req.body;
    if (!follow_up_date) return res.status(400).json({ message: "Date is required" });
    const existing = await query("SELECT id FROM follow_ups WHERE id = ?", [req.params.id]);
    if (!existing.length) return res.status(404).json({ message: "Follow-up not found" });
    await query(
      `UPDATE follow_ups SET follow_up_date = ?, follow_up_time = ?, status = 'rescheduled' WHERE id = ?`,
      [follow_up_date, follow_up_time || null, req.params.id]
    );
    await logActivity(req.user.id, "updated", "follow_up", req.params.id, "Follow-up rescheduled");
    const rows = await query(`${SELECT} WHERE f.id = ?`, [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const existing = await query("SELECT id FROM follow_ups WHERE id = ?", [req.params.id]);
    if (!existing.length) return res.status(404).json({ message: "Follow-up not found" });
    await query("DELETE FROM follow_ups WHERE id = ?", [req.params.id]);
    await logActivity(req.user.id, "deleted", "follow_up", Number(req.params.id), "Follow-up deleted");
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getOne, create, update, complete, reschedule, remove };
