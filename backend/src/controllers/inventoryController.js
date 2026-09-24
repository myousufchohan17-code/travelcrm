const { query } = require("../config/db");
const { logActivity, parsePositiveInt } = require("../utils/helpers");

const CATEGORIES = ["Hotels", "Rooms", "Flights / Seats", "Transport", "Vehicles", "Travel Packages", "Tours", "Activities", "Visa Services", "Other"];
const STATUSES = ["available", "reserved", "low_availability", "out_of_stock", "inactive"];

function asInt(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function statusFor(item, requested) {
  if (requested === "inactive") return "inactive";
  if (item.available_quantity <= 0) return "out_of_stock";
  if (item.available_quantity <= item.low_stock_threshold) return "low_availability";
  if (item.reserved_quantity > 0 && item.available_quantity === 0) return "reserved";
  return "available";
}

function normalize(body, existing = {}) {
  const quantity = asInt(body.quantity, existing.quantity || 0);
  const reserved = asInt(body.reserved_quantity, existing.reserved_quantity || 0);
  const available = body.available_quantity === "" || body.available_quantity == null
    ? Math.max(0, quantity - reserved)
    : asInt(body.available_quantity, 0);
  const item = {
    quantity,
    reserved_quantity: reserved,
    available_quantity: available,
    low_stock_threshold: asInt(body.low_stock_threshold, existing.low_stock_threshold ?? 5),
    availability_status: String(body.availability_status || body.status || existing.availability_status || existing.status || "available").toLowerCase(),
  };
  if (available + reserved !== quantity) return { error: "Total quantity must equal available quantity plus reserved quantity" };
  if (available < 0 || reserved < 0) return { error: "Inventory quantities cannot be negative" };
  const requested = String(body.status || existing.status || "available").toLowerCase();
  return { ...item, status: statusFor(item, STATUSES.includes(requested) ? requested : "available") };
}

const SELECT = `SELECT i.*, d.name AS destination_name FROM inventory i LEFT JOIN destinations d ON d.id = i.destination_id`;

function formatDateValue(value) {
  if (!value) return null;
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  if (typeof value === "string") {
    return value.slice(0, 10);
  }
  return String(value).slice(0, 10);
}

function formatDateTimeValue(value) {
  if (!value) return null;
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    const hours = String(value.getHours()).padStart(2, "0");
    const minutes = String(value.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    const datePart = trimmed.slice(0, 10);
    const timePart = trimmed.includes("T") ? trimmed.slice(11, 16) : trimmed.slice(10, 16);
    return datePart && timePart ? `${datePart}T${timePart}` : trimmed.slice(0, 16);
  }
  return String(value).slice(0, 16);
}

function normalizeInventoryRow(row = {}) {
  return {
    ...row,
    start_date: formatDateValue(row.start_date),
    end_date: formatDateValue(row.end_date),
    valid_from: formatDateValue(row.valid_from),
    valid_until: formatDateValue(row.valid_until),
    departure_date_time: formatDateTimeValue(row.departure_date_time),
    return_date_time: formatDateTimeValue(row.return_date_time),
  };
}

async function list(req, res, next) {
  try {
    const page = parsePositiveInt(req.query.page, 1);
    const limit = Math.min(parsePositiveInt(req.query.limit, 10), 50);
    const q = String(req.query.q || "").trim();
    const category = String(req.query.category || "").trim();
    const status = String(req.query.status || "").trim();
    const availability = String(req.query.availability || "").trim();
    const clauses = [];
    const params = [];
    if (q) { clauses.push("(i.name LIKE ? OR i.supplier LIKE ? OR d.name LIKE ? OR i.category LIKE ?)"); params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`); }
    if (CATEGORIES.includes(category)) { clauses.push("i.category = ?"); params.push(category); }
    if (STATUSES.includes(status)) { clauses.push("i.status = ?"); params.push(status); }
    if (availability === "available") clauses.push("i.available_quantity > 0");
    if (availability === "low") clauses.push("i.available_quantity > 0 AND i.available_quantity <= i.low_stock_threshold");
    if (availability === "out") clauses.push("i.available_quantity = 0");
    const where = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
    const sortMap = { name: "i.name ASC", quantity: "i.quantity DESC", available: "i.available_quantity DESC", price: "i.selling_price DESC", newest: "i.created_at DESC" };
    const order = sortMap[req.query.sort] || sortMap.newest;
    const [count] = await query(`SELECT COUNT(*) AS count FROM inventory i LEFT JOIN destinations d ON d.id = i.destination_id${where}`, params);
    const data = await query(`${SELECT}${where} ORDER BY ${order} LIMIT ${limit} OFFSET ${(page - 1) * limit}`, params);
    res.json({ data: data.map(normalizeInventoryRow), total: Number(count.count), page, limit });
  } catch (err) { next(err); }
}

async function summary(_req, res, next) {
  try {
    const [row] = await query(`SELECT COUNT(*) AS total_inventory, COALESCE(SUM(available_quantity),0) AS available, COALESCE(SUM(reserved_quantity),0) AS reserved, COALESCE(SUM(CASE WHEN status = 'low_availability' THEN 1 ELSE 0 END),0) AS low_availability, COALESCE(SUM(CASE WHEN status = 'out_of_stock' THEN 1 ELSE 0 END),0) AS out_of_stock FROM inventory`);
    res.json(Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value)])));
  } catch (err) { next(err); }
}

async function getOne(req, res, next) {
  try { const rows = await query(`${SELECT} WHERE i.id = ?`, [req.params.id]); if (!rows.length) return res.status(404).json({ message: "Inventory item not found" }); res.json(normalizeInventoryRow(rows[0])); } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    if (!String(req.body.name || "").trim()) return res.status(400).json({ message: "Item name is required" });
    if (!CATEGORIES.includes(req.body.category)) return res.status(400).json({ message: "A valid category is required" });
    const values = normalize(req.body);
    if (values.error) return res.status(400).json({ message: values.error });
    const payload = {
      name: req.body.name.trim(),
      category: req.body.category,
      description: req.body.description || null,
      supplier: req.body.supplier || null,
      supplier_reference: req.body.supplier_reference || null,
      destination_id: req.body.destination_id || null,
      destination_country: req.body.destination_country || req.body.country || null,
      city_location: req.body.city_location || req.body.location || null,
      departure_location: req.body.departure_location || null,
      arrival_location: req.body.arrival_location || null,
      quantity: values.quantity,
      available_quantity: values.available_quantity,
      reserved_quantity: values.reserved_quantity,
      low_stock_threshold: values.low_stock_threshold,
      unit_cost: Number(req.body.unit_cost) || 0,
      selling_price: Number(req.body.selling_price) || 0,
      currency: req.body.currency || "USD",
      price_type: req.body.price_type || "fixed",
      markup_profit: Number(req.body.markup_profit) || 0,
      location: req.body.location || req.body.city_location || null,
      start_date: req.body.start_date || null,
      end_date: req.body.end_date || null,
      valid_from: req.body.valid_from || null,
      valid_until: req.body.valid_until || null,
      departure_date_time: req.body.departure_date_time || null,
      return_date_time: req.body.return_date_time || null,
      availability_status: values.availability_status || values.status,
      status: values.status,
      inclusions: req.body.inclusions || null,
      exclusions: req.body.exclusions || null,
      terms_conditions: req.body.terms_conditions || null,
      notes: req.body.notes || null,
    };
    const result = await query(`INSERT INTO inventory (name, category, description, supplier, supplier_reference, destination_id, destination_country, city_location, departure_location, arrival_location, quantity, available_quantity, reserved_quantity, low_stock_threshold, unit_cost, selling_price, currency, price_type, markup_profit, location, start_date, end_date, valid_from, valid_until, departure_date_time, return_date_time, availability_status, status, inclusions, exclusions, terms_conditions, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [payload.name, payload.category, payload.description, payload.supplier, payload.supplier_reference, payload.destination_id, payload.destination_country, payload.city_location, payload.departure_location, payload.arrival_location, payload.quantity, payload.available_quantity, payload.reserved_quantity, payload.low_stock_threshold, payload.unit_cost, payload.selling_price, payload.currency, payload.price_type, payload.markup_profit, payload.location, payload.start_date, payload.end_date, payload.valid_from, payload.valid_until, payload.departure_date_time, payload.return_date_time, payload.availability_status, payload.status, payload.inclusions, payload.exclusions, payload.terms_conditions, payload.notes]);
    await logActivity(req.user.id, "created", "inventory", result.insertId, "Inventory item created");
    const rows = await query(`${SELECT} WHERE i.id = ?`, [result.insertId]); res.status(201).json(normalizeInventoryRow(rows[0]));
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const existing = await query("SELECT * FROM inventory WHERE id = ?", [req.params.id]);
    if (!existing.length) return res.status(404).json({ message: "Inventory item not found" });
    if (!String(req.body.name || "").trim() || !CATEGORIES.includes(req.body.category)) return res.status(400).json({ message: "Item name and a valid category are required" });
    const values = normalize(req.body, existing[0]); if (values.error) return res.status(400).json({ message: values.error });
    const payload = {
      name: req.body.name.trim(),
      category: req.body.category,
      description: req.body.description || null,
      supplier: req.body.supplier || null,
      supplier_reference: req.body.supplier_reference || null,
      destination_id: req.body.destination_id || null,
      destination_country: req.body.destination_country || req.body.country || null,
      city_location: req.body.city_location || req.body.location || null,
      departure_location: req.body.departure_location || null,
      arrival_location: req.body.arrival_location || null,
      quantity: values.quantity,
      available_quantity: values.available_quantity,
      reserved_quantity: values.reserved_quantity,
      low_stock_threshold: values.low_stock_threshold,
      unit_cost: Number(req.body.unit_cost) || 0,
      selling_price: Number(req.body.selling_price) || 0,
      currency: req.body.currency || "USD",
      price_type: req.body.price_type || "fixed",
      markup_profit: Number(req.body.markup_profit) || 0,
      location: req.body.location || req.body.city_location || null,
      start_date: req.body.start_date || null,
      end_date: req.body.end_date || null,
      valid_from: req.body.valid_from || null,
      valid_until: req.body.valid_until || null,
      departure_date_time: req.body.departure_date_time || null,
      return_date_time: req.body.return_date_time || null,
      availability_status: values.availability_status || values.status,
      status: values.status,
      inclusions: req.body.inclusions || null,
      exclusions: req.body.exclusions || null,
      terms_conditions: req.body.terms_conditions || null,
      notes: req.body.notes || null,
    };
    await query(`UPDATE inventory SET name=?, category=?, description=?, supplier=?, supplier_reference=?, destination_id=?, destination_country=?, city_location=?, departure_location=?, arrival_location=?, quantity=?, available_quantity=?, reserved_quantity=?, low_stock_threshold=?, unit_cost=?, selling_price=?, currency=?, price_type=?, markup_profit=?, location=?, start_date=?, end_date=?, valid_from=?, valid_until=?, departure_date_time=?, return_date_time=?, availability_status=?, status=?, inclusions=?, exclusions=?, terms_conditions=?, notes=? WHERE id=?`, [payload.name, payload.category, payload.description, payload.supplier, payload.supplier_reference, payload.destination_id, payload.destination_country, payload.city_location, payload.departure_location, payload.arrival_location, payload.quantity, payload.available_quantity, payload.reserved_quantity, payload.low_stock_threshold, payload.unit_cost, payload.selling_price, payload.currency, payload.price_type, payload.markup_profit, payload.location, payload.start_date, payload.end_date, payload.valid_from, payload.valid_until, payload.departure_date_time, payload.return_date_time, payload.availability_status, payload.status, payload.inclusions, payload.exclusions, payload.terms_conditions, payload.notes, req.params.id]);
    await logActivity(req.user.id, "updated", "inventory", req.params.id, "Inventory item updated");
    const rows = await query(`${SELECT} WHERE i.id = ?`, [req.params.id]); res.json(normalizeInventoryRow(rows[0]));
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try { const existing = await query("SELECT id FROM inventory WHERE id = ?", [req.params.id]); if (!existing.length) return res.status(404).json({ message: "Inventory item not found" }); await query("DELETE FROM inventory WHERE id = ?", [req.params.id]); await logActivity(req.user.id, "deleted", "inventory", req.params.id, "Inventory item deleted"); res.json({ success: true }); } catch (err) { next(err); }
}

async function adjustReservation(id, amount) {
  const rows = await query("SELECT * FROM inventory WHERE id = ?", [id]);
  if (!rows.length) throw new Error("Selected inventory item was not found");
  const item = rows[0]; const nextAvailable = Number(item.available_quantity) - amount; const nextReserved = Number(item.reserved_quantity) + amount;
  if (nextAvailable < 0 || nextReserved < 0) throw new Error("Not enough inventory is available for this booking");
  const status = statusFor({ available_quantity: nextAvailable, reserved_quantity: nextReserved, low_stock_threshold: Number(item.low_stock_threshold) }, item.status);
  await query("UPDATE inventory SET available_quantity=?, reserved_quantity=?, status=? WHERE id=?", [nextAvailable, nextReserved, status, id]);
}

module.exports = { list, summary, getOne, create, update, remove, adjustReservation, CATEGORIES, STATUSES };
