const { query } = require("../config/db");

async function summary(_req, res, next) {
  try {
    const bookingsByStatus = await query(
      `SELECT status, COUNT(*) AS count, COALESCE(SUM(total_amount), 0) AS revenue
       FROM bookings GROUP BY status`
    );
    const revenueMonthly = await query(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') AS label,
              COALESCE(SUM(CASE WHEN status IN ('confirmed','completed') THEN total_amount ELSE 0 END), 0) AS revenue,
              COUNT(*) AS bookings
       FROM bookings
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
       GROUP BY label
       ORDER BY label ASC`
    );
    const clientGrowth = await query(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') AS label, COUNT(*) AS count
       FROM clients
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
       GROUP BY label
       ORDER BY label ASC`
    );
    const destinationPopularity = await query(
      `SELECT d.id, d.name, d.image, COUNT(b.id) AS bookings,
              COALESCE(SUM(CASE WHEN b.status IN ('confirmed','completed') THEN b.total_amount ELSE 0 END), 0) AS revenue
       FROM destinations d
       INNER JOIN bookings b ON b.destination_id = d.id
       WHERE b.status <> 'cancelled'
       GROUP BY d.id, d.name, d.image
       ORDER BY bookings DESC
       LIMIT 10`
    );
    const packagePerformance = await query(
      `SELECT p.id, p.name, p.category, COUNT(b.id) AS bookings,
              COALESCE(SUM(CASE WHEN b.status IN ('confirmed','completed') THEN b.total_amount ELSE 0 END), 0) AS revenue
       FROM travel_packages p
       INNER JOIN bookings b ON b.package_id = p.id
       WHERE b.status <> 'cancelled'
       GROUP BY p.id, p.name, p.category
       ORDER BY bookings DESC
       LIMIT 10`
    );
    const agentPerformance = await query(
      `SELECT a.id, a.full_name,
              COUNT(b.id) AS bookings,
              COALESCE(SUM(CASE WHEN b.status IN ('confirmed','completed') THEN b.total_amount ELSE 0 END), 0) AS revenue
       FROM agents a
       INNER JOIN bookings b ON b.assigned_agent_id = a.id
       WHERE b.status <> 'cancelled'
       GROUP BY a.id, a.full_name
       ORDER BY bookings DESC
       LIMIT 10`
    );

    res.json({
      bookingsByStatus: bookingsByStatus.map((r) => ({
        ...r,
        count: Number(r.count),
        revenue: Number(r.revenue),
      })),
      revenueMonthly: revenueMonthly.map((r) => ({
        ...r,
        revenue: Number(r.revenue),
        bookings: Number(r.bookings),
      })),
      clientGrowth: clientGrowth.map((r) => ({ ...r, count: Number(r.count) })),
      destinationPopularity: destinationPopularity.map((r) => ({
        ...r,
        bookings: Number(r.bookings),
        revenue: Number(r.revenue),
      })),
      packagePerformance: packagePerformance.map((r) => ({
        ...r,
        bookings: Number(r.bookings),
        revenue: Number(r.revenue),
      })),
      agentPerformance: agentPerformance.map((r) => ({
        ...r,
        bookings: Number(r.bookings),
        revenue: Number(r.revenue),
      })),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { summary };
