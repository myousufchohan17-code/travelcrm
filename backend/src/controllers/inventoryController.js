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
  const item = { quantity, reserved_quantity: reserved, available_quantity: available, low_stock_threshold: asInt(body.low_stock_threshold, existing.low_stock_threshold ?? 5) };
  if (available + reserved !== quantity) return { error: "Total quantity must equal available quantity plus reserved quantity" };
  if (available < 0 || reserved < 0) return { error: "Inventory quantities cannot be negative" };
  const requested = String(body.status || existing.status || "available").toLowerCase();
  return { ...item, status: statusFor(item, STATUSES.includes(requested) ? requested : "available") };
}

const SELECT = `SELECT i.*, d.name AS destination_name FROM inventory i LEFT JOIN destinations d ON d.id = i.destination_id`;

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
    res.json({ data, total: Number(count.count), page, limit });
  } catch (err) { next(err); }
}

async function summary(_req, res, next) {
  try {
    const [row] = await query(`SELECT COUNT(*) AS total_inventory, COALESCE(SUM(available_quantity),0) AS available, COALESCE(SUM(reserved_quantity),0) AS reserved, COALESCE(SUM(CASE WHEN status = 'low_availability' THEN 1 ELSE 0 END),0) AS low_availability, COALESCE(SUM(CASE WHEN status = 'out_of_stock' THEN 1 ELSE 0 END),0) AS out_of_stock FROM inventory`);
    res.json(Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value)])));
  } catch (err) { next(err); }
}

async function getOne(req, res, next) {
  try { const rows = await query(`${SELECT} WHERE i.id = ?`, [req.params.id]); if (!rows.length) return res.status(404).json({ message: "Inventory item not found" }); res.json(rows[0]); } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    if (!String(req.body.name || "").trim()) return res.status(400).json({ message: "Item name is required" });
    if (!CATEGORIES.includes(req.body.category)) return res.status(400).json({ message: "A valid category is required" });
    const values = normalize(req.body);
    if (values.error) return res.status(400).json({ message: values.error });
    const result = await query(`INSERT INTO inventory (name, category, description, supplier, destination_id, quantity, available_quantity, reserved_quantity, low_stock_threshold, unit_cost, selling_price, location, start_date, end_date, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [req.body.name.trim(), req.body.category, req.body.description || null, req.body.supplier || null, req.body.destination_id || null, values.quantity, values.available_quantity, values.reserved_quantity, values.low_stock_threshold, Number(req.body.unit_cost) || 0, Number(req.body.selling_price) || 0, req.body.location || null, req.body.start_date || null, req.body.end_date || null, values.status, req.body.notes || null]);
    await logActivity(req.user.id, "created", "inventory", result.insertId, "Inventory item created");
    const rows = await query(`${SELECT} WHERE i.id = ?`, [result.insertId]); res.status(201).json(rows[0]);
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const existing = await query("SELECT * FROM inventory WHERE id = ?", [req.params.id]);
    if (!existing.length) return res.status(404).json({ message: "Inventory item not found" });
    if (!String(req.body.name || "").trim() || !CATEGORIES.includes(req.body.category)) return res.status(400).json({ message: "Item name and a valid category are required" });
    const values = normalize(req.body, existing[0]); if (values.error) return res.status(400).json({ message: values.error });
    await query(`UPDATE inventory SET name=?, category=?, description=?, supplier=?, destination_id=?, quantity=?, available_quantity=?, reserved_quantity=?, low_stock_threshold=?, unit_cost=?, selling_price=?, location=?, start_date=?, end_date=?, status=?, notes=? WHERE id=?`, [req.body.name.trim(), req.body.category, req.body.description || null, req.body.supplier || null, req.body.destination_id || null, values.quantity, values.available_quantity, values.reserved_quantity, values.low_stock_threshold, Number(req.body.unit_cost) || 0, Number(req.body.selling_price) || 0, req.body.location || null, req.body.start_date || null, req.body.end_date || null, values.status, req.body.notes || null, req.params.id]);
    await logActivity(req.user.id, "updated", "inventory", req.params.id, "Inventory item updated");
    const rows = await query(`${SELECT} WHERE i.id = ?`, [req.params.id]); res.json(rows[0]);
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
