const { query } = require("../config/db");
const { logActivity, uploadedImage } = require("../utils/helpers");

async function list(_req, res, next) {
  try {
    const rows = await query(
      `SELECT d.*,
        (SELECT COUNT(*) FROM bookings b WHERE b.destination_id = d.id AND b.status <> 'cancelled') AS bookings
       FROM destinations d
       ORDER BY d.name ASC`
    );
    res.json(rows.map((r) => ({ ...r, bookings: Number(r.bookings) })));
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { name, country } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "Destination name is required" });
    }
    const image = uploadedImage(req, "destinations");
    const result = await query(
      "INSERT INTO destinations (name, country, image) VALUES (?, ?, ?)",
      [name.trim(), country || null, image]
    );
    await logActivity(req.user.id, "created", "destination", result.insertId, `Destination added: ${name.trim()}`);
    const rows = await query("SELECT * FROM destinations WHERE id = ?", [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const existing = await query("SELECT image FROM destinations WHERE id = ?", [req.params.id]);
    if (!existing.length) return res.status(404).json({ message: "Destination not found" });
    const { name, country } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "Destination name is required" });
    }
    const image = uploadedImage(req, "destinations") || existing[0].image;
    await query("UPDATE destinations SET name = ?, country = ?, image = ? WHERE id = ?", [
      name.trim(),
      country || null,
      image,
      req.params.id,
    ]);
    const rows = await query("SELECT * FROM destinations WHERE id = ?", [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const existing = await query("SELECT name FROM destinations WHERE id = ?", [req.params.id]);
    if (!existing.length) return res.status(404).json({ message: "Destination not found" });
    await query("UPDATE clients SET preferred_destination_id = NULL WHERE preferred_destination_id = ?", [
      req.params.id,
    ]);
    await query("UPDATE travel_packages SET destination_id = NULL WHERE destination_id = ?", [req.params.id]);
    await query("UPDATE bookings SET destination_id = NULL WHERE destination_id = ?", [req.params.id]);
    await query("UPDATE leads SET interested_destination_id = NULL WHERE interested_destination_id = ?", [
      req.params.id,
    ]);
    await query("DELETE FROM destinations WHERE id = ?", [req.params.id]);
    await logActivity(req.user.id, "deleted", "destination", Number(req.params.id), `Destination deleted: ${existing[0].name}`);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, remove };
