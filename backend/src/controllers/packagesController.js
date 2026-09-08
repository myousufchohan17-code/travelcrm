const { query } = require("../config/db");
const { logActivity, parsePositiveInt, uploadedImage } = require("../utils/helpers");

const CATEGORIES = ["International", "Domestic", "Honeymoon", "Group Tours", "Other"];

function validatePackage(body) {
  const errors = [];
  if (!body.name || !String(body.name).trim()) errors.push("Package name is required");
  if (body.category && !CATEGORIES.includes(body.category)) errors.push("Invalid category");
  if (body.price != null && Number(body.price) < 0) errors.push("Price cannot be negative");
  return errors;
}

const SELECT = `
  SELECT p.*, d.name AS destination_name, d.country AS destination_country
  FROM travel_packages p
  LEFT JOIN destinations d ON d.id = p.destination_id
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
      clauses.push("(p.name LIKE ? OR d.name LIKE ? OR p.category LIKE ?)");
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (status === "active" || status === "inactive") {
      clauses.push("p.status = ?");
      params.push(status);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const totalRows = await query(
      `SELECT COUNT(*) AS count FROM travel_packages p
       LEFT JOIN destinations d ON d.id = p.destination_id ${where}`,
      params
    );
    const rows = await query(
      `${SELECT} ${where} ORDER BY p.created_at DESC LIMIT ${limit} OFFSET ${offset}`,
      params
    );
    res.json({ data: rows, total: Number(totalRows[0].count), page, limit });
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const rows = await query(`${SELECT} WHERE p.id = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: "Package not found" });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

function payloadFrom(req) {
  const body = req.body;
  return [
    String(body.name || "").trim(),
    CATEGORIES.includes(body.category) ? body.category : "Other",
    body.destination_id || null,
    body.duration || null,
    body.price || 0,
    body.description || null,
    body.included_services || null,
    body.excluded_services || null,
    body.status === "inactive" ? "inactive" : "active",
  ];
}

async function create(req, res, next) {
  try {
    const errors = validatePackage(req.body);
    if (errors.length) return res.status(400).json({ message: errors[0], errors });
    const image = uploadedImage(req, "packages");
    const result = await query(
      `INSERT INTO travel_packages
        (name, category, destination_id, duration, price, description, included_services, excluded_services, status, image)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [...payloadFrom(req), image]
    );
    await logActivity(req.user.id, "created", "package", result.insertId, `Package created: ${req.body.name}`);
    const created = await query(`${SELECT} WHERE p.id = ?`, [result.insertId]);
    res.status(201).json(created[0]);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const errors = validatePackage(req.body);
    if (errors.length) return res.status(400).json({ message: errors[0], errors });
    const existing = await query("SELECT image FROM travel_packages WHERE id = ?", [req.params.id]);
    if (!existing.length) return res.status(404).json({ message: "Package not found" });
    const image = uploadedImage(req, "packages") || existing[0].image;
    await query(
      `UPDATE travel_packages SET
        name = ?, category = ?, destination_id = ?, duration = ?, price = ?, description = ?,
        included_services = ?, excluded_services = ?, status = ?, image = ?
       WHERE id = ?`,
      [...payloadFrom(req), image, req.params.id]
    );
    await logActivity(req.user.id, "updated", "package", req.params.id, `Package updated: ${req.body.name}`);
    const rows = await query(`${SELECT} WHERE p.id = ?`, [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

async function patchStatus(req, res, next) {
  try {
    const status = req.body.status === "inactive" ? "inactive" : "active";
    const existing = await query("SELECT id FROM travel_packages WHERE id = ?", [req.params.id]);
    if (!existing.length) return res.status(404).json({ message: "Package not found" });
    await query("UPDATE travel_packages SET status = ? WHERE id = ?", [status, req.params.id]);
    await logActivity(req.user.id, "updated", "package", req.params.id, `Package ${status}`);
    const rows = await query(`${SELECT} WHERE p.id = ?`, [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const existing = await query("SELECT name FROM travel_packages WHERE id = ?", [req.params.id]);
    if (!existing.length) return res.status(404).json({ message: "Package not found" });
    await query("UPDATE bookings SET package_id = NULL WHERE package_id = ?", [req.params.id]);
    await query("DELETE FROM travel_packages WHERE id = ?", [req.params.id]);
    await logActivity(req.user.id, "deleted", "package", Number(req.params.id), `Package deleted: ${existing[0].name}`);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getOne, create, update, patchStatus, remove };
