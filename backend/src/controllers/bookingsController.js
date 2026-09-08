const { query } = require("../config/db");
const { logActivity, notify, parsePositiveInt } = require("../utils/helpers");

const STATUSES = ["pending", "confirmed", "processing", "cancelled", "completed"];
const PAYMENTS = ["unpaid", "partial", "paid", "refunded"];

function validateBooking(body) {
  const errors = [];
  if (!body.client_id) errors.push("Client is required");
  if (!body.departure_date) errors.push("Departure date is required");
  if (body.status && !STATUSES.includes(body.status)) errors.push("Invalid booking status");
  if (body.payment_status && !PAYMENTS.includes(body.payment_status)) {
    errors.push("Invalid payment status");
  }
  return errors;
}

const SELECT = `
  SELECT b.*,
    c.full_name AS client_name, c.email AS client_email, c.phone AS client_phone,
    p.name AS package_name, p.image AS package_image,
    d.name AS destination_name, d.image AS destination_image,
    a.full_name AS agent_name
  FROM bookings b
  LEFT JOIN clients c ON c.id = b.client_id
  LEFT JOIN travel_packages p ON p.id = b.package_id
  LEFT JOIN destinations d ON d.id = b.destination_id
  LEFT JOIN agents a ON a.id = b.assigned_agent_id
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
      clauses.push("(c.full_name LIKE ? OR d.name LIKE ? OR p.name LIKE ?)");
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (status && STATUSES.includes(status)) {
      clauses.push("b.status = ?");
      params.push(status);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const totalRows = await query(
      `SELECT COUNT(*) AS count FROM bookings b
       LEFT JOIN clients c ON c.id = b.client_id
       LEFT JOIN destinations d ON d.id = b.destination_id
       LEFT JOIN travel_packages p ON p.id = b.package_id
       ${where}`,
      params
    );
    const rows = await query(
      `${SELECT} ${where} ORDER BY b.created_at DESC LIMIT ${limit} OFFSET ${offset}`,
      params
    );
    res.json({ data: rows, total: Number(totalRows[0].count), page, limit });
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const rows = await query(`${SELECT} WHERE b.id = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: "Booking not found" });
    const travelers = await query("SELECT * FROM booking_travelers WHERE booking_id = ?", [
      req.params.id,
    ]);
    res.json({ ...rows[0], travelers });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const errors = validateBooking(req.body);
    if (errors.length) return res.status(400).json({ message: errors[0], errors });
    const {
      client_id, package_id, destination_id, departure_date, return_date,
      travelers, total_amount, payment_status, status, assigned_agent_id, notes,
    } = req.body;
    const result = await query(
      `INSERT INTO bookings
        (client_id, package_id, destination_id, departure_date, return_date, travelers,
         total_amount, payment_status, status, assigned_agent_id, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        client_id,
        package_id || null,
        destination_id || null,
        departure_date,
        return_date || null,
        travelers || 1,
        total_amount || 0,
        payment_status || "unpaid",
        status || "pending",
        assigned_agent_id || null,
        notes || null,
      ]
    );
    await logActivity(req.user.id, "created", "booking", result.insertId, "Booking created");
    await notify(req.user.id, "New booking", "A new booking was created", "success", "/bookings");
    const created = await query(`${SELECT} WHERE b.id = ?`, [result.insertId]);
    res.status(201).json(created[0]);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const errors = validateBooking(req.body);
    if (errors.length) return res.status(400).json({ message: errors[0], errors });
    const existing = await query("SELECT id FROM bookings WHERE id = ?", [req.params.id]);
    if (!existing.length) return res.status(404).json({ message: "Booking not found" });
    const {
      client_id, package_id, destination_id, departure_date, return_date,
      travelers, total_amount, payment_status, status, assigned_agent_id, notes,
    } = req.body;
    await query(
      `UPDATE bookings SET
        client_id = ?, package_id = ?, destination_id = ?, departure_date = ?, return_date = ?,
        travelers = ?, total_amount = ?, payment_status = ?, status = ?, assigned_agent_id = ?, notes = ?
       WHERE id = ?`,
      [
        client_id,
        package_id || null,
        destination_id || null,
        departure_date,
        return_date || null,
        travelers || 1,
        total_amount || 0,
        payment_status || "unpaid",
        status || "pending",
        assigned_agent_id || null,
        notes || null,
        req.params.id,
      ]
    );
    await logActivity(req.user.id, "updated", "booking", req.params.id, "Booking updated");
    const rows = await query(`${SELECT} WHERE b.id = ?`, [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

async function patchStatus(req, res, next) {
  try {
    const { status } = req.body;
    if (!STATUSES.includes(status)) {
      return res.status(400).json({ message: "Invalid booking status" });
    }
    const existing = await query("SELECT id FROM bookings WHERE id = ?", [req.params.id]);
    if (!existing.length) return res.status(404).json({ message: "Booking not found" });
    await query("UPDATE bookings SET status = ? WHERE id = ?", [status, req.params.id]);
    await logActivity(req.user.id, "updated", "booking", req.params.id, `Booking status set to ${status}`);
    const rows = await query(`${SELECT} WHERE b.id = ?`, [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

async function patchAgent(req, res, next) {
  try {
    const { assigned_agent_id } = req.body;
    const existing = await query("SELECT id FROM bookings WHERE id = ?", [req.params.id]);
    if (!existing.length) return res.status(404).json({ message: "Booking not found" });
    await query("UPDATE bookings SET assigned_agent_id = ? WHERE id = ?", [
      assigned_agent_id || null,
      req.params.id,
    ]);
    await logActivity(req.user.id, "updated", "booking", req.params.id, "Booking agent assigned");
    const rows = await query(`${SELECT} WHERE b.id = ?`, [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const existing = await query("SELECT id FROM bookings WHERE id = ?", [req.params.id]);
    if (!existing.length) return res.status(404).json({ message: "Booking not found" });
    await query("DELETE FROM bookings WHERE id = ?", [req.params.id]);
    await logActivity(req.user.id, "deleted", "booking", Number(req.params.id), "Booking deleted");
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getOne, create, update, patchStatus, patchAgent, remove };
