const { query } = require("../config/db");
const { pctChange } = require("../utils/helpers");

async function stats(_req, res, next) {
  try {
    const [clients] = await query("SELECT COUNT(*) AS count FROM clients");
    const [bookings] = await query("SELECT COUNT(*) AS count FROM bookings");
    const [packages] = await query(
      "SELECT COUNT(*) AS count FROM travel_packages WHERE status = 'active'"
    );
    const [revenue] = await query(
      `SELECT COALESCE(SUM(total_amount), 0) AS total
       FROM bookings
       WHERE status IN ('confirmed', 'completed')`
    );

    const [clientsPrev] = await query(
      `SELECT COUNT(*) AS count FROM clients
       WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)`
    );
    const [clientsNow] = await query(
      `SELECT COUNT(*) AS count FROM clients
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`
    );
    const [bookingsPrev] = await query(
      `SELECT COUNT(*) AS count FROM bookings
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 60 DAY)
         AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)`
    );
    const [bookingsNow] = await query(
      `SELECT COUNT(*) AS count FROM bookings
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`
    );
    const [revPrev] = await query(
      `SELECT COALESCE(SUM(total_amount), 0) AS total FROM bookings
       WHERE status IN ('confirmed', 'completed')
         AND created_at >= DATE_SUB(NOW(), INTERVAL 60 DAY)
         AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)`
    );
    const [revNow] = await query(
      `SELECT COALESCE(SUM(total_amount), 0) AS total FROM bookings
       WHERE status IN ('confirmed', 'completed')
         AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`
    );
    const [pkgPrev] = await query(
      `SELECT COUNT(*) AS count FROM travel_packages
       WHERE status = 'active' AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)`
    );
    const [pkgNow] = await query(
      `SELECT COUNT(*) AS count FROM travel_packages
       WHERE status = 'active' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`
    );

    const prevClients = Number(clientsPrev.count);
    const prevBookings = Number(bookingsPrev.count);
    const prevRevenue = Number(revPrev.total);
    const prevPackages = Number(pkgPrev.count);

    res.json({
      totalClients: Number(clients.count),
      totalBookings: Number(bookings.count),
      activePackages: Number(packages.count),
      totalRevenue: Number(revenue.total),
      clientsChange: prevClients + Number(clientsNow.count) > 0 && prevClients > 0
        ? pctChange(Number(clientsNow.count) + prevClients, prevClients)
        : null,
      bookingsChange: prevBookings > 0 ? pctChange(Number(bookingsNow.count), prevBookings) : null,
      packagesChange: prevPackages > 0 ? pctChange(Number(pkgNow.count) + prevPackages, prevPackages) : null,
      revenueChange: prevRevenue > 0 ? pctChange(Number(revNow.total), prevRevenue) : null,
    });
  } catch (err) {
    next(err);
  }
}

function rangeClause(range) {
  switch (range) {
    case "7d":
      return "created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)";
    case "3m":
      return "created_at >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)";
    case "year":
      return "YEAR(created_at) = YEAR(CURDATE())";
    case "30d":
    default:
      return "created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)";
  }
}

function groupExpr(range) {
  if (range === "year" || range === "3m") return "DATE_FORMAT(created_at, '%Y-%m')";
  return "DATE(created_at)";
}

async function bookingsOverview(req, res, next) {
  try {
    const range = req.query.range || "30d";
    const where = rangeClause(range);
    const group = groupExpr(range);
    const rows = await query(
      `SELECT ${group} AS label, COUNT(*) AS count, COALESCE(SUM(total_amount), 0) AS revenue
       FROM bookings
       WHERE ${where}
       GROUP BY label
       ORDER BY label ASC`
    );
    res.json(rows.map((r) => ({ ...r, count: Number(r.count), revenue: Number(r.revenue) })));
  } catch (err) {
    next(err);
  }
}

async function packageCategories(_req, res, next) {
  try {
    const rows = await query(
      `SELECT category, COUNT(*) AS count
       FROM travel_packages
       GROUP BY category
       HAVING count > 0
       ORDER BY count DESC`
    );
    const total = rows.reduce((sum, r) => sum + Number(r.count), 0);
    res.json({
      total,
      items: rows.map((r) => ({ category: r.category, count: Number(r.count) })),
    });
  } catch (err) {
    next(err);
  }
}

async function recentClients(_req, res, next) {
  try {
    const rows = await query(
      `SELECT
         c.id, c.full_name, c.email, c.phone, c.created_at,
         COALESCE(d.name, pd.name) AS destination,
         COALESCE(d.image, pd.image) AS destination_image,
         b.departure_date AS travel_date,
         b.status AS booking_status
       FROM clients c
       LEFT JOIN destinations pd ON pd.id = c.preferred_destination_id
       LEFT JOIN bookings b ON b.id = (
         SELECT b2.id FROM bookings b2
         WHERE b2.client_id = c.id
         ORDER BY b2.created_at DESC
         LIMIT 1
       )
       LEFT JOIN destinations d ON d.id = b.destination_id
       ORDER BY c.created_at DESC
       LIMIT 6`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function upcomingBookings(_req, res, next) {
  try {
    const rows = await query(
      `SELECT
         b.id, b.departure_date, b.status, b.travelers, b.total_amount,
         c.full_name AS client_name,
         COALESCE(p.name, d.name) AS title,
         COALESCE(p.image, d.image) AS image,
         d.name AS destination_name
       FROM bookings b
       LEFT JOIN clients c ON c.id = b.client_id
       LEFT JOIN travel_packages p ON p.id = b.package_id
       LEFT JOIN destinations d ON d.id = b.destination_id
       WHERE b.departure_date >= CURDATE()
         AND b.status NOT IN ('cancelled')
       ORDER BY b.departure_date ASC
       LIMIT 6`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function topDestinations(_req, res, next) {
  try {
    const current = await query(
      `SELECT d.id, d.name, d.country, d.image, COUNT(b.id) AS bookings
       FROM destinations d
       INNER JOIN bookings b ON b.destination_id = d.id
       WHERE b.status <> 'cancelled'
       GROUP BY d.id, d.name, d.country, d.image
       ORDER BY bookings DESC
       LIMIT 5`
    );
    const previous = await query(
      `SELECT destination_id, COUNT(*) AS bookings
       FROM bookings
       WHERE status <> 'cancelled'
         AND created_at >= DATE_SUB(NOW(), INTERVAL 60 DAY)
         AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
       GROUP BY destination_id`
    );
    const prevMap = Object.fromEntries(previous.map((r) => [r.destination_id, Number(r.bookings)]));
    res.json(
      current.map((row) => ({
        ...row,
        bookings: Number(row.bookings),
        growth: pctChange(Number(row.bookings), prevMap[row.id] || 0),
      }))
    );
  } catch (err) {
    next(err);
  }
}

async function search(req, res, next) {
  try {
    const q = String(req.query.q || "").trim();
    if (q.length < 2) {
      return res.json({ clients: [], bookings: [], packages: [], leads: [], destinations: [], agents: [] });
    }
    const like = `%${q}%`;
    const [clients, bookings, packages, leads, destinations, agents] = await Promise.all([
      query(
        `SELECT id, full_name, email, phone FROM clients
         WHERE full_name LIKE ? OR email LIKE ? OR phone LIKE ?
         LIMIT 8`,
        [like, like, like]
      ),
      query(
        `SELECT b.id, c.full_name AS client_name, d.name AS destination, b.departure_date, b.status
         FROM bookings b
         LEFT JOIN clients c ON c.id = b.client_id
         LEFT JOIN destinations d ON d.id = b.destination_id
         WHERE c.full_name LIKE ? OR d.name LIKE ? OR b.status LIKE ?
         LIMIT 8`,
        [like, like, like]
      ),
      query(
        `SELECT p.id, p.name, p.category, p.price, d.name AS destination
         FROM travel_packages p
         LEFT JOIN destinations d ON d.id = p.destination_id
         WHERE p.name LIKE ? OR p.category LIKE ? OR d.name LIKE ?
         LIMIT 8`,
        [like, like, like]
      ),
      query(
        `SELECT id, name, email, phone, status FROM leads
         WHERE name LIKE ? OR email LIKE ? OR phone LIKE ?
         LIMIT 8`,
        [like, like, like]
      ),
      query(
        `SELECT id, name, country FROM destinations
         WHERE name LIKE ? OR country LIKE ?
         LIMIT 8`,
        [like, like]
      ),
      query(
        `SELECT id, full_name AS name, email, phone FROM agents
         WHERE full_name LIKE ? OR email LIKE ? OR phone LIKE ?
         LIMIT 8`,
        [like, like, like]
      ),
    ]);
    res.json({ clients, bookings, packages, leads, destinations, agents });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  stats,
  bookingsOverview,
  packageCategories,
  recentClients,
  upcomingBookings,
  topDestinations,
  search,
};
