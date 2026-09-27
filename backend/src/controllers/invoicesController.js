const crypto = require("crypto");
const { query } = require("../config/db");
const { logActivity, parsePositiveInt } = require("../utils/helpers");

const STATUSES = ["pending", "paid", "overdue", "cancelled"];
const METHODS = ["cash", "card", "bank transfer", "mobile wallet", "other"];

const SELECT = `
  SELECT i.*,
    COALESCE(i.client_name, c.full_name) AS client_name,
    COALESCE(i.client_email, c.email) AS client_email,
    COALESCE(i.client_phone, c.phone) AS client_phone,
    COALESCE(i.client_address, c.address) AS client_address,
    c.full_name AS current_client_name
  FROM invoices i
  LEFT JOIN clients c ON c.id = i.client_id
`;

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function normalizeItems(items) {
  if (!Array.isArray(items) || !items.length) throw new Error("Add at least one invoice item");
  return items.map((item) => {
    const description = String(item.description || "").trim();
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unit_price ?? item.unitPrice);
    if (!description) throw new Error("Every item needs a description");
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("Item quantity must be greater than zero");
    if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new Error("Unit price must be zero or greater");
    return { description, quantity, unitPrice: roundMoney(unitPrice), total: roundMoney(quantity * unitPrice) };
  });
}

function parseInvoice(row) {
  if (!row) return row;
  let items = row.items;
  if (typeof items === "string") {
    try { items = JSON.parse(items); } catch { items = []; }
  }
  return { ...row, items: items || [], remaining_balance: roundMoney(Number(row.total) - Number(row.amount_paid)) };
}

function currentStatus(row) {
  if (row.status === "pending" && row.due_date < new Date().toISOString().slice(0, 10)) return "overdue";
  return row.status;
}

function invoiceNumber() {
  const day = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `INV-${day}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

async function syncBookingPayment(bookingId) {
  if (!bookingId) return;
  const totals = await query(
    `SELECT COALESCE(SUM(total), 0) AS total, COALESCE(SUM(amount_paid), 0) AS paid
     FROM invoices WHERE booking_id = ? AND status <> 'cancelled'`,
    [bookingId]
  );
  const total = Number(totals[0].total);
  const paid = Number(totals[0].paid);
  const status = total > 0 && paid >= total ? "paid" : paid > 0 ? "partial" : "unpaid";
  await query("UPDATE bookings SET payment_status = ? WHERE id = ?", [status, bookingId]);
}

function invoiceInput(body) {
  const errors = [];
  const issueDate = body.issue_date;
  const dueDate = body.due_date;
  if (!body.client_id) errors.push("Client is required");
  if (!validDate(issueDate)) errors.push("A valid invoice date is required");
  if (!validDate(dueDate)) errors.push("A valid due date is required");
  if (validDate(issueDate) && validDate(dueDate) && dueDate < issueDate) errors.push("Due date cannot be before the invoice date");
  if (body.travel_start_date && !validDate(body.travel_start_date)) errors.push("Travel start date is invalid");
  if (body.travel_end_date && !validDate(body.travel_end_date)) errors.push("Travel end date is invalid");
  if (body.travel_start_date && body.travel_end_date && body.travel_end_date < body.travel_start_date) errors.push("Travel end date cannot be before the start date");
  if (body.status && !STATUSES.includes(body.status)) errors.push("Invalid invoice status");
  if (body.payment_method && !METHODS.includes(String(body.payment_method).toLowerCase())) errors.push("Invalid payment method");
  let items = [];
  try { items = normalizeItems(body.items); } catch (error) { errors.push(error.message); }
  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.total, 0));
  const discount = Number(body.discount || 0);
  const tax = Number(body.tax || 0);
  if (!Number.isFinite(discount) || discount < 0 || discount > subtotal) errors.push("Discount must be between zero and the subtotal");
  if (!Number.isFinite(tax) || tax < 0) errors.push("Tax must be zero or greater");
  const total = roundMoney(subtotal - discount + tax);
  const amountPaid = Number(body.amount_paid || 0);
  if (!Number.isFinite(amountPaid) || amountPaid < 0 || amountPaid > total) errors.push("Paid amount must be between zero and the invoice total");
  return {
    errors,
    items,
    subtotal,
    discount: roundMoney(discount || 0),
    tax: roundMoney(tax || 0),
    total,
    amountPaid: body.status === "paid" ? total : roundMoney(amountPaid || 0),
  };
}

async function list(req, res, next) {
  try {
    const page = parsePositiveInt(req.query.page, 1);
    const limit = Math.min(parsePositiveInt(req.query.limit, 10), 50);
    const offset = (page - 1) * limit;
    const clauses = [];
    const params = [];
    const search = String(req.query.q || "").trim();
    if (search) {
      clauses.push("(i.invoice_number LIKE ? OR COALESCE(i.client_name, c.full_name) LIKE ? OR i.booking_label LIKE ?)");
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      if (/^\d+$/.test(search)) {
        clauses[clauses.length - 1] = `${clauses[clauses.length - 1].slice(0, -1)} OR i.booking_id = ?)`;
        params.push(Number(search));
      }
    }
    const status = String(req.query.status || "");
    if (status === "overdue") {
      clauses.push("i.status = 'pending' AND i.due_date < CURRENT_DATE");
    } else if (STATUSES.includes(status)) {
      clauses.push("i.status = ?");
      params.push(status);
    }
    if (req.query.client_id) {
      clauses.push("i.client_id = ?");
      params.push(req.query.client_id);
    }
    if (req.query.date_from && validDate(req.query.date_from)) {
      clauses.push("i.issue_date >= ?");
      params.push(req.query.date_from);
    }
    if (req.query.date_to && validDate(req.query.date_to)) {
      clauses.push("i.issue_date <= ?");
      params.push(req.query.date_to);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const orderBy = {
      oldest: "i.issue_date ASC, i.id ASC",
      amount_asc: "i.total ASC, i.id DESC",
      amount_desc: "i.total DESC, i.id DESC",
    }[req.query.sort] || "i.issue_date DESC, i.id DESC";
    const count = await query(
      `SELECT COUNT(*) AS count FROM invoices i LEFT JOIN clients c ON c.id = i.client_id ${where}`,
      params
    );
    const rows = await query(`${SELECT} ${where} ORDER BY ${orderBy} LIMIT ${limit} OFFSET ${offset}`, params);
    res.json({ data: rows.map((row) => ({ ...parseInvoice(row), status: currentStatus(row) })), total: Number(count[0].count), page, limit });
  } catch (err) {
    next(err);
  }
}

async function summary(_req, res, next) {
  try {
    const rows = await query(
      `SELECT COUNT(*) AS total_invoices, COALESCE(SUM(total), 0) AS total_amount,
         SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) AS paid_invoices,
         SUM(CASE WHEN status = 'pending' AND due_date >= CURRENT_DATE THEN 1 ELSE 0 END) AS pending_invoices
       FROM invoices`
    );
    const row = rows[0];
    res.json({
      totalInvoices: Number(row.total_invoices),
      totalAmount: Number(row.total_amount),
      paidInvoices: Number(row.paid_invoices || 0),
      pendingInvoices: Number(row.pending_invoices || 0),
    });
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const rows = await query(`${SELECT} WHERE i.id = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: "Invoice not found" });
    const payments = await query("SELECT * FROM invoice_payments WHERE invoice_id = ? ORDER BY payment_date DESC, id DESC", [req.params.id]);
    res.json({ ...parseInvoice(rows[0]), status: currentStatus(rows[0]), payments });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const input = invoiceInput(req.body);
    if (input.errors.length) return res.status(400).json({ message: input.errors[0], errors: input.errors });
    const clients = await query("SELECT * FROM clients WHERE id = ?", [req.body.client_id]);
    if (!clients.length) return res.status(400).json({ message: "Selected client was not found" });
    let booking = null;
    if (req.body.booking_id) {
      const bookings = await query(
        `SELECT b.*, c.full_name AS client_name, c.email AS client_email, c.phone AS client_phone,
           c.address AS client_address, p.name AS package_name, d.name AS destination_name
         FROM bookings b LEFT JOIN clients c ON c.id = b.client_id
         LEFT JOIN travel_packages p ON p.id = b.package_id
         LEFT JOIN destinations d ON d.id = b.destination_id WHERE b.id = ?`,
        [req.body.booking_id]
      );
      if (!bookings.length) return res.status(400).json({ message: "Selected booking was not found" });
      booking = bookings[0];
      if (String(booking.client_id) !== String(req.body.client_id)) return res.status(400).json({ message: "The selected booking belongs to a different client" });
    }
    const client = clients[0];
    const startDate = req.body.travel_start_date || booking?.departure_date || null;
    const endDate = req.body.travel_end_date || booking?.return_date || null;
    const destination = String(req.body.destination || booking?.destination_name || "").trim() || null;
    const bookingLabel = booking ? [booking.package_name, booking.destination_name].filter(Boolean).join(" - ") || `Booking #${booking.id}` : null;
    const amountPaid = input.amountPaid;
    const status = amountPaid >= input.total && amountPaid > 0 ? "paid" : (req.body.status === "cancelled" || req.body.status === "overdue" ? req.body.status : "pending");
    const result = await query(
      `INSERT INTO invoices
        (invoice_number, client_id, booking_id, client_name, client_email, client_phone, client_address,
         booking_label, issue_date, due_date, destination, travel_start_date, travel_end_date, items,
         subtotal, discount, tax, total, amount_paid, status, payment_method, payment_date, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        invoiceNumber(), client.id, booking?.id || null, client.full_name, client.email || null,
        client.phone || null, client.address || null, bookingLabel, req.body.issue_date, req.body.due_date,
        destination, startDate, endDate, JSON.stringify(input.items), input.subtotal, input.discount,
        input.tax, input.total, amountPaid, status, req.body.payment_method || null,
        amountPaid > 0 ? req.body.payment_date || req.body.issue_date : null, req.body.notes || null,
      ]
    );
    if (amountPaid > 0) {
      await query("INSERT INTO invoice_payments (invoice_id, amount, payment_date, payment_method) VALUES (?, ?, ?, ?)", [
        result.insertId, amountPaid, req.body.payment_date || req.body.issue_date, req.body.payment_method || null,
      ]);
    }
    await syncBookingPayment(booking?.id);
    await logActivity(req.user.id, "created", "invoice", result.insertId, "Invoice created");
    const created = await query(`${SELECT} WHERE i.id = ?`, [result.insertId]);
    res.status(201).json(parseInvoice(created[0]));
  } catch (err) {
    if (err.message?.startsWith("Add at least") || err.message?.startsWith("Every item") || err.message?.startsWith("Item ")) {
      return res.status(400).json({ message: err.message });
    }
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const input = invoiceInput(req.body);
    if (input.errors.length) return res.status(400).json({ message: input.errors[0], errors: input.errors });
    const current = await query("SELECT * FROM invoices WHERE id = ?", [req.params.id]);
    if (!current.length) return res.status(404).json({ message: "Invoice not found" });
    if (input.amountPaid < Number(current[0].amount_paid)) return res.status(400).json({ message: "Paid amount cannot be reduced; record a refund separately" });
    const clients = await query("SELECT * FROM clients WHERE id = ?", [req.body.client_id]);
    if (!clients.length) return res.status(400).json({ message: "Selected client was not found" });
    let bookingId = req.body.booking_id || null;
    let bookingLabel = current[0].booking_label;
    if (bookingId) {
      const bookings = await query(
        `SELECT b.id, b.client_id, p.name AS package_name, d.name AS destination_name
         FROM bookings b LEFT JOIN travel_packages p ON p.id = b.package_id
         LEFT JOIN destinations d ON d.id = b.destination_id WHERE b.id = ?`,
        [bookingId]
      );
      if (!bookings.length) return res.status(400).json({ message: "Selected booking was not found" });
      if (String(bookings[0].client_id) !== String(req.body.client_id)) return res.status(400).json({ message: "The selected booking belongs to a different client" });
      bookingLabel = [bookings[0].package_name, bookings[0].destination_name].filter(Boolean).join(" - ") || `Booking #${bookings[0].id}`;
    }
    const client = clients[0];
    const status = req.body.status === "cancelled" || req.body.status === "overdue" ? req.body.status : input.amountPaid >= input.total && input.amountPaid > 0 ? "paid" : "pending";
    await query(
      `UPDATE invoices SET client_id = ?, booking_id = ?, client_name = ?, client_email = ?, client_phone = ?,
         client_address = ?, booking_label = ?, issue_date = ?, due_date = ?, destination = ?,
         travel_start_date = ?, travel_end_date = ?, items = ?, subtotal = ?, discount = ?, tax = ?,
         total = ?, amount_paid = ?, status = ?, payment_method = ?, payment_date = ?, notes = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        client.id, bookingId, client.full_name, client.email || null, client.phone || null, client.address || null,
        bookingLabel, req.body.issue_date, req.body.due_date, req.body.destination || null,
        req.body.travel_start_date || null, req.body.travel_end_date || null, JSON.stringify(input.items),
        input.subtotal, input.discount, input.tax, input.total, input.amountPaid, status,
        req.body.payment_method || null, req.body.payment_date || null, req.body.notes || null, req.params.id,
      ]
    );
    if (input.amountPaid > Number(current[0].amount_paid)) {
      await query("INSERT INTO invoice_payments (invoice_id, amount, payment_date, payment_method) VALUES (?, ?, ?, ?)", [
        req.params.id, roundMoney(input.amountPaid - Number(current[0].amount_paid)), req.body.payment_date || req.body.issue_date,
        req.body.payment_method || null,
      ]);
    }
    await syncBookingPayment(current[0].booking_id);
    if (bookingId !== current[0].booking_id) await syncBookingPayment(bookingId);
    await logActivity(req.user.id, "updated", "invoice", req.params.id, "Invoice updated");
    const updated = await query(`${SELECT} WHERE i.id = ?`, [req.params.id]);
    res.json(parseInvoice(updated[0]));
  } catch (err) {
    if (err.message?.startsWith("Add at least") || err.message?.startsWith("Every item") || err.message?.startsWith("Item ")) {
      return res.status(400).json({ message: err.message });
    }
    next(err);
  }
}

async function payment(req, res, next) {
  try {
    const rows = await query("SELECT * FROM invoices WHERE id = ?", [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: "Invoice not found" });
    const invoice = rows[0];
    const action = req.body.action;
    if (!["record", "paid", "pending", "overdue", "cancelled"].includes(action)) {
      return res.status(400).json({ message: "Invalid payment action" });
    }
    if (["pending", "overdue"].includes(action) && Number(invoice.amount_paid) >= Number(invoice.total)) {
      return res.status(400).json({ message: "A fully paid invoice cannot be reopened" });
    }
    let amountPaid = Number(invoice.amount_paid);
    let status = invoice.status;
    let method = req.body.payment_method || invoice.payment_method;
    let date = req.body.payment_date || new Date().toISOString().slice(0, 10);
    if (action === "record" || action === "paid") {
      if (!validDate(date)) return res.status(400).json({ message: "A valid payment date is required" });
      const amount = action === "paid" ? roundMoney(Number(invoice.total) - amountPaid) : Number(req.body.amount);
      if (!Number.isFinite(amount) || amount <= 0 || amount > Number(invoice.total) - amountPaid) {
        return res.status(400).json({ message: "Payment must be greater than zero and cannot exceed the remaining balance" });
      }
      if (method && !METHODS.includes(String(method).toLowerCase())) return res.status(400).json({ message: "Invalid payment method" });
      amountPaid = roundMoney(amountPaid + amount);
      status = amountPaid >= Number(invoice.total) ? "paid" : "pending";
      await query("INSERT INTO invoice_payments (invoice_id, amount, payment_date, payment_method, reference) VALUES (?, ?, ?, ?, ?)", [
        invoice.id, amount, date, method || null, req.body.reference || null,
      ]);
    } else {
      status = action;
    }
    await query("UPDATE invoices SET amount_paid = ?, status = ?, payment_method = ?, payment_date = ?, updated_at = NOW() WHERE id = ?", [
      amountPaid, status, method || null, action === "pending" || action === "overdue" || action === "cancelled" ? invoice.payment_date : date, invoice.id,
    ]);
    await syncBookingPayment(invoice.booking_id);
    await logActivity(req.user.id, "updated", "invoice", invoice.id, `Invoice payment status set to ${status}`);
    const updated = await query(`${SELECT} WHERE i.id = ?`, [invoice.id]);
    const payments = await query("SELECT * FROM invoice_payments WHERE invoice_id = ? ORDER BY payment_date DESC, id DESC", [invoice.id]);
    res.json({ ...parseInvoice(updated[0]), status: currentStatus(updated[0]), payments });
  } catch (err) {
    next(err);
  }
}

async function send(req, res, next) {
  try {
    const rows = await query(`${SELECT} WHERE i.id = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: "Invoice not found" });
    const invoice = rows[0];
    if (!invoice.client_id) return res.status(400).json({ message: "This invoice has no active CRM client to message" });
    const conversations = await query("SELECT id FROM conversations WHERE client_id = ? LIMIT 1", [invoice.client_id]);
    let conversationId = conversations[0]?.id;
    if (!conversationId) {
      const conversation = await query("INSERT INTO conversations (client_id, channel, last_message_at) VALUES (?, 'internal', NOW())", [invoice.client_id]);
      conversationId = conversation.insertId;
    }
    const remaining = roundMoney(Number(invoice.total) - Number(invoice.amount_paid));
    const body = `Invoice ${invoice.invoice_number} for ${Number(invoice.total).toLocaleString()} is ${currentStatus(invoice)}. Remaining balance: ${remaining.toLocaleString()}. Due ${invoice.due_date}. View invoice: /invoices?invoice=${invoice.id}`;
    const message = await query("INSERT INTO messages (conversation_id, sender_type, sender_id, body, is_read) VALUES (?, 'user', ?, ?, 1)", [conversationId, req.user.id, body]);
    await query("UPDATE conversations SET last_message_at = NOW() WHERE id = ?", [conversationId]);
    await logActivity(req.user.id, "created", "message", message.insertId, `Invoice ${invoice.invoice_number} shared with client`);
    res.status(201).json({ success: true, conversation_id: conversationId, message: "Invoice shared in the client CRM conversation" });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const rows = await query("SELECT id, invoice_number, booking_id FROM invoices WHERE id = ?", [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: "Invoice not found" });
    await query("DELETE FROM invoices WHERE id = ?", [req.params.id]);
    await syncBookingPayment(rows[0].booking_id);
    await logActivity(req.user.id, "deleted", "invoice", rows[0].id, `Invoice deleted: ${rows[0].invoice_number}`);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, summary, getOne, create, update, payment, send, remove };