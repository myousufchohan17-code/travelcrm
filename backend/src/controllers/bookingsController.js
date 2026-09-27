const { query } = require("../config/db");
const { logActivity, notify, parsePositiveInt } = require("../utils/helpers");
const { adjustReservation } = require("./inventoryController");

const STATUSES = ["pending", "confirmed", "processing", "cancelled", "completed"];
const PAYMENTS = ["unpaid", "partial", "paid", "refunded"];

function affectedRows(result) {
  return Array.isArray(result) ? result.length : Number(result.affectedRows) || 0;
}

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
    const [totalRows, rows] = await Promise.all([
      query(
        `SELECT COUNT(*) AS count FROM bookings b
         LEFT JOIN clients c ON c.id = b.client_id
         LEFT JOIN destinations d ON d.id = b.destination_id
         LEFT JOIN travel_packages p ON p.id = b.package_id
         ${where}`,
        params
      ),
      query(`${SELECT} ${where} ORDER BY b.created_at DESC LIMIT ${limit} OFFSET ${offset}`, params),
    ]);
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
    const invoices = await query(
      "SELECT id, invoice_number, issue_date, due_date, total, amount_paid, status FROM invoices WHERE booking_id = ? ORDER BY created_at DESC",
      [req.params.id]
    );
    res.json({ ...rows[0], travelers, invoices });
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
      travelers, total_amount, payment_status, status, assigned_agent_id, inventory_id, inventory_quantity, notes,
    } = req.body;
    const inventoryQuantity = inventory_quantity == null || inventory_quantity === "" ? 0 : Number(inventory_quantity);
    if (!Number.isInteger(inventoryQuantity) || inventoryQuantity < 0 || (inventoryQuantity && !inventory_id)) return res.status(400).json({ message: "Select an inventory item and a valid whole-number quantity" });
    const reservationActive = Boolean(inventory_id && inventoryQuantity && status !== "cancelled");
    if (reservationActive) await adjustReservation(inventory_id, inventoryQuantity);
    let result;
    try {
      result = await query(
        `INSERT INTO bookings
          (client_id, package_id, destination_id, departure_date, return_date, travelers,
           total_amount, payment_status, status, assigned_agent_id, inventory_id, inventory_quantity, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          inventory_id || null,
          inventoryQuantity,
          notes || null,
        ]
      );
    } catch (err) {
      if (reservationActive) await adjustReservation(inventory_id, -inventoryQuantity);
      throw err;
    }
    const [created] = await Promise.all([
      query(`${SELECT} WHERE b.id = ?`, [result.insertId]),
      logActivity(req.user.id, "created", "booking", result.insertId, "Booking created"),
      notify(req.user.id, "New booking", "A new booking was created", "success", "/bookings"),
    ]);
    res.status(201).json(created[0]);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const errors = validateBooking(req.body);
    if (errors.length) return res.status(400).json({ message: errors[0], errors });
    const existing = await query("SELECT * FROM bookings WHERE id = ?", [req.params.id]);
    if (!existing.length) return res.status(404).json({ message: "Booking not found" });
    const {
      client_id, package_id, destination_id, departure_date, return_date,
      travelers, total_amount, payment_status, status, assigned_agent_id, inventory_id, inventory_quantity, notes,
    } = req.body;
    const inventoryQuantity = inventory_quantity == null || inventory_quantity === "" ? 0 : Number(inventory_quantity);
    if (!Number.isInteger(inventoryQuantity) || inventoryQuantity < 0 || (inventoryQuantity && !inventory_id)) return res.status(400).json({ message: "Select an inventory item and a valid whole-number quantity" });
    const old = existing[0];
    const previousReservation = old.inventory_id && old.status !== "cancelled" ? { id: old.inventory_id, quantity: Number(old.inventory_quantity) } : null;
    const nextReservation = inventory_id && inventoryQuantity && status !== "cancelled" ? { id: inventory_id, quantity: inventoryQuantity } : null;
    const undo = [];
    let rows;
    try {
      if (previousReservation && nextReservation && String(previousReservation.id) === String(nextReservation.id)) {
        const delta = nextReservation.quantity - previousReservation.quantity;
        if (delta) {
          await adjustReservation(nextReservation.id, delta);
          undo.push(() => adjustReservation(nextReservation.id, -delta));
        }
      } else {
        if (previousReservation?.quantity) {
          await adjustReservation(previousReservation.id, -previousReservation.quantity);
          undo.push(() => adjustReservation(previousReservation.id, previousReservation.quantity));
        }
        if (nextReservation) {
          await adjustReservation(nextReservation.id, nextReservation.quantity);
          undo.push(() => adjustReservation(nextReservation.id, -nextReservation.quantity));
        }
      }
      const saved = await query(
        `UPDATE bookings SET
          client_id = ?, package_id = ?, destination_id = ?, departure_date = ?, return_date = ?,
          travelers = ?, total_amount = ?, payment_status = ?, status = ?, assigned_agent_id = ?, inventory_id = ?, inventory_quantity = ?, notes = ?
         WHERE id = ? AND inventory_quantity = ? AND status = ?
           AND ((inventory_id = ?) OR (inventory_id IS NULL AND ? IS NULL))
         RETURNING id`,
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
          inventory_id || null,
          inventoryQuantity,
          notes || null,
          req.params.id,
          Number(old.inventory_quantity) || 0,
          old.status,
          old.inventory_id || null,
          old.inventory_id || null,
        ]
      );
      if (!affectedRows(saved)) {
        const error = new Error("This booking changed while you were editing it. Reload the booking and try again.");
        error.status = 409;
        throw error;
      }
    } catch (err) {
      for (const revert of undo.reverse()) await revert();
      throw err;
    }
    [rows] = await Promise.all([
      query(`${SELECT} WHERE b.id = ?`, [req.params.id]),
      logActivity(req.user.id, "updated", "booking", req.params.id, "Booking updated"),
    ]);
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
    const existing = await query("SELECT * FROM bookings WHERE id = ?", [req.params.id]);
    if (!existing.length) return res.status(404).json({ message: "Booking not found" });
    const booking = existing[0];
    let inventoryAdjustment = 0;
    if (booking.inventory_id && Number(booking.inventory_quantity)) {
      if (booking.status !== "cancelled" && status === "cancelled") inventoryAdjustment = -Number(booking.inventory_quantity);
      if (booking.status === "cancelled" && status !== "cancelled") inventoryAdjustment = Number(booking.inventory_quantity);
    }
    if (inventoryAdjustment) await adjustReservation(booking.inventory_id, inventoryAdjustment);
    let rows;
    try {
      const saved = await query(
        `UPDATE bookings SET status = ?
         WHERE id = ? AND status = ? AND inventory_quantity = ?
           AND ((inventory_id = ?) OR (inventory_id IS NULL AND ? IS NULL))
         RETURNING id`,
        [status, req.params.id, booking.status, Number(booking.inventory_quantity) || 0, booking.inventory_id || null, booking.inventory_id || null]
      );
      if (!affectedRows(saved)) {
        const error = new Error("This booking changed while its status was updating. Refresh and try again.");
        error.status = 409;
        throw error;
      }
    } catch (err) {
      if (inventoryAdjustment) await adjustReservation(booking.inventory_id, -inventoryAdjustment);
      throw err;
    }
    [rows] = await Promise.all([
      query(`${SELECT} WHERE b.id = ?`, [req.params.id]),
      logActivity(req.user.id, "updated", "booking", req.params.id, `Booking status set to ${status}`),
    ]);
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
    const existing = await query("SELECT * FROM bookings WHERE id = ?", [req.params.id]);
    if (!existing.length) return res.status(404).json({ message: "Booking not found" });
    const booking = existing[0];
    const inventoryAdjustment = booking.inventory_id && Number(booking.inventory_quantity) && booking.status !== "cancelled" ? -Number(booking.inventory_quantity) : 0;
    if (inventoryAdjustment) await adjustReservation(booking.inventory_id, inventoryAdjustment);
    try {
      const deleted = await query(
        `DELETE FROM bookings WHERE id = ? AND status = ? AND inventory_quantity = ?
           AND ((inventory_id = ?) OR (inventory_id IS NULL AND ? IS NULL))
         RETURNING id`,
        [req.params.id, booking.status, Number(booking.inventory_quantity) || 0, booking.inventory_id || null, booking.inventory_id || null]
      );
      if (!affectedRows(deleted)) {
        const error = new Error("This booking changed while it was being deleted. Refresh and try again.");
        error.status = 409;
        throw error;
      }
    } catch (err) {
      if (inventoryAdjustment) await adjustReservation(booking.inventory_id, -inventoryAdjustment);
      throw err;
    }
    await logActivity(req.user.id, "deleted", "booking", Number(req.params.id), "Booking deleted");
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getOne, create, update, patchStatus, patchAgent, remove };
