const { query } = require("../config/db");

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function daysInt(value, fallback, max = 365) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(max, n);
}

function limitInt(value, fallback = 15, max = 25) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(max, n);
}

function like(value) {
  return `%${String(value || "").trim().toLowerCase()}%`;
}

function pick(row, keys) {
  const out = {};
  keys.forEach((key) => {
    if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
      out[key] = /date|created_at|updated_at|last_booking/i.test(key) ? toIsoDate(row[key]) : row[key];
    }
  });
  return out;
}

function toIsoDate(value) {
  const text = String(value || "");
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

async function dbToday() {
  const [row] = await query("SELECT CURDATE() AS today");
  return toIsoDate(row?.today);
}

function addDays(iso, amount) {
  const d = new Date(`${toIsoDate(iso)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + amount);
  return d.toISOString().slice(0, 10);
}

function monthBounds(todayIso, offset = 0) {
  const [y, m] = todayIso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + offset, 1));
  const start = date.toISOString().slice(0, 10);
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
  return { start, next };
}

async function getCustomers(args = {}) {
  const limit = limitInt(args.limit);
  const recentDays = args.recentlyDays ? daysInt(args.recentlyDays, 30, 180) : null;
  const q = String(args.query || "").trim();
  const clauses = [];
  const params = [];

  if (q) {
    clauses.push("(LOWER(c.full_name) LIKE ? OR LOWER(IFNULL(c.email, '')) LIKE ? OR LOWER(c.phone) LIKE ?)");
    params.push(like(q), like(q), like(q));
  }
  if (recentDays) {
    clauses.push(`c.created_at >= DATE_SUB(NOW(), INTERVAL ${recentDays} DAY)`);
  }
  if (args.withoutRecentBookings) {
    clauses.push(`(
      lastb.last_booking IS NULL
      OR lastb.last_booking < DATE_SUB(NOW(), INTERVAL 90 DAY)
    )`);
  }
  if (args.withUpcomingTrips) {
    clauses.push(`EXISTS (
      SELECT 1 FROM bookings ub
      WHERE ub.client_id = c.id
        AND ub.departure_date >= CURDATE()
        AND ub.status NOT IN ('cancelled')
    )`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = await query(
    `SELECT
       c.id, c.full_name, c.email, c.phone, c.country, c.created_at,
       d.name AS preferred_destination,
       lastb.last_booking,
       (SELECT COUNT(*) FROM bookings b WHERE b.client_id = c.id AND b.status <> 'cancelled') AS booking_count
     FROM clients c
     LEFT JOIN destinations d ON d.id = c.preferred_destination_id
     LEFT JOIN (
       SELECT client_id, MAX(created_at) AS last_booking
       FROM bookings
       WHERE status <> 'cancelled'
       GROUP BY client_id
     ) lastb ON lastb.client_id = c.id
     ${where}
     ORDER BY c.created_at DESC
     LIMIT ${limit}`,
    params
  );

  const [total] = await query("SELECT COUNT(*) AS count FROM clients");
  return {
    total_customers: num(total?.count),
    results: rows.map((row) => ({
      ...pick(row, ["id", "full_name", "email", "phone", "country", "preferred_destination", "created_at", "last_booking"]),
      booking_count: num(row.booking_count),
    })),
  };
}

async function searchCustomer(args = {}) {
  const q = String(args.query || "").trim();
  if (q.length < 2) return { results: [], note: "Search query was too short." };
  const found = await getCustomers({ query: q, limit: 5 });
  const results = [];
  for (const customer of found.results) {
    const bookings = await query(
      `SELECT
         b.id, b.departure_date, b.return_date, b.status, b.payment_status,
         b.travelers, b.total_amount,
         p.name AS package_name,
         d.name AS destination
       FROM bookings b
       LEFT JOIN travel_packages p ON p.id = b.package_id
       LEFT JOIN destinations d ON d.id = b.destination_id
       WHERE b.client_id = ?
       ORDER BY b.departure_date DESC
       LIMIT 10`,
      [customer.id]
    );
    results.push({
      ...customer,
      travel_history: bookings.map((row) => ({
        ...pick(row, ["id", "departure_date", "return_date", "status", "payment_status", "package_name", "destination"]),
        travelers: num(row.travelers),
        total_amount: num(row.total_amount),
      })),
    });
  }
  return { results };
}

async function getLeads(args = {}) {
  const limit = limitInt(args.limit);
  const clauses = [];
  const params = [];
  const status = String(args.status || "").trim().toLowerCase();
  const allowed = ["new", "contacted", "qualified", "converted", "lost"];

  if (status && allowed.includes(status)) {
    clauses.push("l.status = ?");
    params.push(status);
  } else if (args.openOnly) {
    clauses.push("l.status IN ('new', 'contacted', 'qualified')");
  } else if (args.pending) {
    clauses.push("l.status IN ('new', 'contacted')");
  } else if (args.converted) {
    clauses.push("l.status = 'converted'");
  }

  if (args.today) {
    clauses.push("DATE(l.created_at) = CURDATE()");
  }
  if (args.inactiveDays) {
    const inactive = daysInt(args.inactiveDays, 14, 180);
    clauses.push(`l.updated_at < DATE_SUB(NOW(), INTERVAL ${inactive} DAY)`);
    clauses.push("l.status NOT IN ('converted', 'lost')");
  }

  const order = args.highPriority
    ? "l.budget DESC, l.created_at DESC"
    : args.inactiveDays
      ? "l.updated_at ASC"
      : "l.created_at DESC";

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = await query(
    `SELECT
       l.id, l.name, l.phone, l.email, l.source, l.budget, l.travel_date,
       l.travelers, l.status, l.created_at, l.updated_at,
       d.name AS interested_destination,
       a.full_name AS agent_name
     FROM leads l
     LEFT JOIN destinations d ON d.id = l.interested_destination_id
     LEFT JOIN agents a ON a.id = l.assigned_agent_id
     ${where}
     ORDER BY ${order}
     LIMIT ${limit}`,
    params
  );
  const counts = await query("SELECT status, COUNT(*) AS count FROM leads GROUP BY status");
  const [total] = await query("SELECT COUNT(*) AS count FROM leads");

  return {
    total_leads: num(total?.count),
    by_status: counts.map((row) => ({ status: row.status, count: num(row.count) })),
    results: rows.map((row) => ({
      ...pick(row, ["id", "name", "phone", "email", "source", "travel_date", "status", "interested_destination", "agent_name", "created_at", "updated_at"]),
      budget: row.budget == null ? null : num(row.budget),
      travelers: num(row.travelers),
    })),
  };
}

async function getBookings(args = {}) {
  const limit = limitInt(args.limit, 20);
  const clauses = ["1=1"];
  const params = [];
  const status = String(args.status || "").trim().toLowerCase();
  const allowed = ["pending", "confirmed", "processing", "cancelled", "completed"];
  const timeframe = String(args.timeframe || args.scope || "all").toLowerCase();
  const customerName = String(args.customerName || args.query || "").trim();

  if (status && allowed.includes(status)) {
    clauses.push("b.status = ?");
    params.push(status);
  } else if (timeframe === "cancelled") {
    clauses.push("b.status = 'cancelled'");
  } else if (timeframe === "pending") {
    clauses.push("b.status = 'pending'");
  } else if (timeframe === "needs_attention") {
    clauses.push("(b.status = 'pending' OR b.payment_status IN ('unpaid', 'partial'))");
    clauses.push("b.status <> 'cancelled'");
  }

  if (timeframe === "today") {
    clauses.push("b.departure_date = CURDATE()");
  } else if (timeframe === "upcoming" || timeframe === "this_week") {
    clauses.push("b.departure_date >= CURDATE()");
    clauses.push("b.status NOT IN ('cancelled')");
  }

  if (customerName) {
    clauses.push("LOWER(IFNULL(c.full_name, '')) LIKE ?");
    params.push(like(customerName));
  }

  const rows = await query(
    `SELECT
       b.id, b.departure_date, b.return_date, b.status, b.payment_status,
       b.travelers, b.total_amount, b.created_at,
       c.full_name AS customer,
       p.name AS package_name,
       d.name AS destination,
       a.full_name AS agent_name
     FROM bookings b
     LEFT JOIN clients c ON c.id = b.client_id
     LEFT JOIN travel_packages p ON p.id = b.package_id
     LEFT JOIN destinations d ON d.id = b.destination_id
     LEFT JOIN agents a ON a.id = b.assigned_agent_id
     WHERE ${clauses.join(" AND ")}
     ORDER BY b.departure_date ASC, b.created_at DESC
     LIMIT ${limit}`,
    params
  );

  let results = rows.map((row) => ({
    ...pick(row, ["id", "customer", "package_name", "destination", "departure_date", "return_date", "status", "payment_status", "agent_name"]),
    travelers: num(row.travelers),
    total_amount: num(row.total_amount),
  }));

  if (timeframe === "this_week") {
    const today = await dbToday();
    const weekEnd = addDays(today, 7);
    results = results.filter((row) => String(row.departure_date || "").slice(0, 10) <= weekEnd);
  }

  const [total] = await query("SELECT COUNT(*) AS count FROM bookings");
  return { total_bookings: num(total?.count), results };
}

async function getUpcomingBookings(args = {}) {
  return getBookings({ ...args, timeframe: "upcoming" });
}

async function getPackages(args = {}) {
  const limit = limitInt(args.limit);
  const packages = await query(
    `SELECT
       p.id, p.name, p.category, p.duration, p.price, p.status,
       d.name AS destination,
       COUNT(b.id) AS booking_count,
       COALESCE(SUM(CASE WHEN b.status IN ('confirmed', 'completed') THEN b.total_amount ELSE 0 END), 0) AS revenue
     FROM travel_packages p
     LEFT JOIN destinations d ON d.id = p.destination_id
     LEFT JOIN bookings b ON b.package_id = p.id AND b.status <> 'cancelled'
     GROUP BY p.id, p.name, p.category, p.duration, p.price, p.status, d.name
     ORDER BY ${args.lowBookings ? "booking_count ASC, p.name ASC" : "booking_count DESC, revenue DESC"}
     LIMIT ${limit}`
  );

  const destinations = await query(
    `SELECT d.id, d.name, d.country, COUNT(b.id) AS bookings
     FROM destinations d
     LEFT JOIN bookings b ON b.destination_id = d.id AND b.status <> 'cancelled'
     GROUP BY d.id, d.name, d.country
     ORDER BY bookings DESC
     LIMIT 10`
  );

  return {
    packages: packages.map((row) => ({
      ...pick(row, ["id", "name", "category", "duration", "status", "destination"]),
      price: num(row.price),
      booking_count: num(row.booking_count),
      revenue: num(row.revenue),
    })),
    popular_destinations: destinations.map((row) => ({
      ...pick(row, ["id", "name", "country"]),
      bookings: num(row.bookings),
    })),
  };
}

async function getRevenueSummary() {
  const today = await dbToday();
  const thisMonth = monthBounds(today, 0);
  const lastMonth = monthBounds(today, -1);

  const [total] = await query(
    `SELECT COALESCE(SUM(total_amount), 0) AS revenue, COUNT(*) AS bookings
     FROM bookings
     WHERE status IN ('confirmed', 'completed')`
  );
  const [thisMonthRow] = await query(
    `SELECT COALESCE(SUM(total_amount), 0) AS revenue, COUNT(*) AS bookings
     FROM bookings
     WHERE status IN ('confirmed', 'completed')
       AND created_at >= ? AND created_at < ?`,
    [thisMonth.start, thisMonth.next]
  );
  const [lastMonthRow] = await query(
    `SELECT COALESCE(SUM(total_amount), 0) AS revenue, COUNT(*) AS bookings
     FROM bookings
     WHERE status IN ('confirmed', 'completed')
       AND created_at >= ? AND created_at < ?`,
    [lastMonth.start, lastMonth.next]
  );
  const [avg] = await query(
    `SELECT COALESCE(AVG(total_amount), 0) AS average
     FROM bookings
     WHERE status IN ('confirmed', 'completed')`
  );
  const byMonth = await query(
    `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month,
            COALESCE(SUM(CASE WHEN status IN ('confirmed','completed') THEN total_amount ELSE 0 END), 0) AS revenue,
            COUNT(*) AS bookings
     FROM bookings
     WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
     GROUP BY month
     ORDER BY month ASC`
  );
  const topPackages = await query(
    `SELECT p.name, COUNT(b.id) AS bookings,
            COALESCE(SUM(CASE WHEN b.status IN ('confirmed','completed') THEN b.total_amount ELSE 0 END), 0) AS revenue
     FROM travel_packages p
     INNER JOIN bookings b ON b.package_id = p.id
     WHERE b.status <> 'cancelled'
     GROUP BY p.id, p.name
     ORDER BY revenue DESC
     LIMIT 5`
  );
  const topCustomers = await query(
    `SELECT c.full_name,
            COUNT(b.id) AS bookings,
            COALESCE(SUM(CASE WHEN b.status IN ('confirmed','completed') THEN b.total_amount ELSE 0 END), 0) AS revenue
     FROM clients c
     INNER JOIN bookings b ON b.client_id = c.id
     WHERE b.status <> 'cancelled'
     GROUP BY c.id, c.full_name
     ORDER BY revenue DESC
     LIMIT 5`
  );

  const thisRev = num(thisMonthRow?.revenue);
  const lastRev = num(lastMonthRow?.revenue);
  return {
    total_revenue: num(total?.revenue),
    total_confirmed_bookings: num(total?.bookings),
    this_month: { start: thisMonth.start, revenue: thisRev, bookings: num(thisMonthRow?.bookings) },
    last_month: { start: lastMonth.start, revenue: lastRev, bookings: num(lastMonthRow?.bookings) },
    month_change_percent: lastRev > 0 ? Math.round(((thisRev - lastRev) / lastRev) * 1000) / 10 : null,
    average_booking_value: Math.round(num(avg?.average) * 100) / 100,
    revenue_by_month: byMonth.map((row) => ({
      month: row.month,
      revenue: num(row.revenue),
      bookings: num(row.bookings),
    })),
    top_packages: topPackages.map((row) => ({
      name: row.name,
      bookings: num(row.bookings),
      revenue: num(row.revenue),
    })),
    top_customers: topCustomers.map((row) => ({
      name: row.full_name,
      bookings: num(row.bookings),
      revenue: num(row.revenue),
    })),
  };
}

async function getFollowUps(args = {}) {
  const limit = limitInt(args.limit);
  const when = String(args.when || "today").toLowerCase();
  const clauses = [];

  if (when === "today") {
    clauses.push("f.follow_up_date = CURDATE()");
    clauses.push("f.status = 'scheduled'");
  } else if (when === "overdue") {
    clauses.push("f.follow_up_date < CURDATE()");
    clauses.push("f.status = 'scheduled'");
  } else if (when === "upcoming") {
    clauses.push("f.follow_up_date >= CURDATE()");
    clauses.push("f.status = 'scheduled'");
  } else if (args.status) {
    clauses.push("f.status = ?");
  } else {
    clauses.push("f.status = 'scheduled'");
  }

  const params = args.status && when === "all" ? [String(args.status)] : [];
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = await query(
    `SELECT
       f.id, f.follow_up_date, f.follow_up_time, f.type, f.status, f.notes,
       c.full_name AS customer,
       l.name AS lead_name,
       a.full_name AS agent_name
     FROM follow_ups f
     LEFT JOIN clients c ON c.id = f.client_id
     LEFT JOIN leads l ON l.id = f.lead_id
     LEFT JOIN agents a ON a.id = f.assigned_agent_id
     ${where}
     ORDER BY f.follow_up_date ASC, f.follow_up_time ASC
     LIMIT ${limit}`,
    params
  );

  const inactiveLeads = await query(
    `SELECT id, name, phone, status, updated_at
     FROM leads
     WHERE status IN ('new', 'contacted', 'qualified')
       AND updated_at < DATE_SUB(NOW(), INTERVAL 7 DAY)
     ORDER BY updated_at ASC
     LIMIT 10`
  );

  const approachingTrips = await query(
    `SELECT c.full_name AS customer, b.departure_date, b.status, d.name AS destination
     FROM bookings b
     LEFT JOIN clients c ON c.id = b.client_id
     LEFT JOIN destinations d ON d.id = b.destination_id
     WHERE b.departure_date >= CURDATE()
       AND b.status NOT IN ('cancelled')
     ORDER BY b.departure_date ASC
     LIMIT 20`
  );
  const today = await dbToday();
  const soon = addDays(today, 14);

  return {
    follow_ups: rows.map((row) => pick(row, ["id", "customer", "lead_name", "follow_up_date", "follow_up_time", "type", "status", "agent_name", "notes"])),
    inactive_leads: inactiveLeads.map((row) => pick(row, ["id", "name", "phone", "status", "updated_at"])),
    approaching_trips: approachingTrips
      .filter((row) => String(row.departure_date || "").slice(0, 10) <= soon)
      .slice(0, 10)
      .map((row) => pick(row, ["customer", "departure_date", "status", "destination"])),
  };
}

async function getTravelSummary() {
  const today = await dbToday();
  const weekEnd = addDays(today, 7);

  const [clients] = await query("SELECT COUNT(*) AS count FROM clients");
  const [clientsToday] = await query("SELECT COUNT(*) AS count FROM clients WHERE DATE(created_at) = CURDATE()");
  const [leads] = await query("SELECT COUNT(*) AS count FROM leads");
  const [leadsToday] = await query("SELECT COUNT(*) AS count FROM leads WHERE DATE(created_at) = CURDATE()");
  const [pendingLeads] = await query("SELECT COUNT(*) AS count FROM leads WHERE status IN ('new', 'contacted')");
  const [bookings] = await query("SELECT COUNT(*) AS count FROM bookings");
  const [pendingBookings] = await query("SELECT COUNT(*) AS count FROM bookings WHERE status = 'pending'");
  const [cancelled] = await query("SELECT COUNT(*) AS count FROM bookings WHERE status = 'cancelled'");
  const [todayTrips] = await query(
    "SELECT COUNT(*) AS count FROM bookings WHERE departure_date = CURDATE() AND status NOT IN ('cancelled')"
  );
  const [followToday] = await query(
    "SELECT COUNT(*) AS count FROM follow_ups WHERE follow_up_date = CURDATE() AND status = 'scheduled'"
  );
  const [revenue] = await query(
    `SELECT COALESCE(SUM(total_amount), 0) AS total
     FROM bookings WHERE status IN ('confirmed', 'completed')`
  );

  const upcoming = await getBookings({ timeframe: "upcoming", limit: 8 });
  const thisWeek = upcoming.results.filter((row) => String(row.departure_date || "").slice(0, 10) <= weekEnd);

  return {
    today,
    new_leads_today: num(leadsToday?.count),
    new_customers_today: num(clientsToday?.count),
    total_customers: num(clients?.count),
    total_leads: num(leads?.count),
    pending_leads: num(pendingLeads?.count),
    total_bookings: num(bookings?.count),
    pending_bookings: num(pendingBookings?.count),
    cancelled_bookings: num(cancelled?.count),
    trips_today: num(todayTrips?.count),
    follow_ups_today: num(followToday?.count),
    upcoming_this_week: thisWeek.length,
    revenue: num(revenue?.total),
    upcoming_bookings: upcoming.results.slice(0, 8),
    trips_this_week: thisWeek,
  };
}

const handlers = {
  getCustomers,
  searchCustomer,
  getLeads,
  getBookings,
  getUpcomingBookings,
  getPackages,
  getRevenueSummary,
  getFollowUps,
  getTravelSummary,
};

async function runTool(name, rawArgs = {}) {
  const fn = handlers[name];
  if (!fn) return { error: "Unknown tool" };
  try {
    return await fn(rawArgs || {});
  } catch (err) {
    console.error("AI CRM tool failed:", name);
    return { error: "crm_unavailable" };
  }
}

module.exports = { runTool, handlers };
