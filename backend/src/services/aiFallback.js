const { runTool } = require("./aiCrmTools");

function money(value) {
  const n = Number(value) || 0;
  return `$${n.toLocaleString()}`;
}

function table(headers, rows) {
  if (!rows?.length) return "";
  const head = `| ${headers.join(" | ")} |`;
  const split = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows
    .map((row) => `| ${row.map((cell) => (cell == null || cell === "" ? "—" : String(cell))).join(" | ")} |`)
    .join("\n");
  return `${head}\n${split}\n${body}`;
}

function none() {
  return "I couldn't find that information in the CRM.";
}

function looksLike(q, words) {
  return words.some((word) => q.includes(word));
}

function extractName(message) {
  const text = String(message || "").trim();
  const named = text.match(/\b(?:named|called|about|for)\s+([A-Za-z][A-Za-z .'-]{1,60})$/i);
  if (named) return named[1].replace(/[?.!]/g, "").trim();
  const find = text.match(/\b(?:find|search|show|tell me about|who is)\s+(?:the\s+)?(?:customer|client|lead)?\s*(.+)$/i);
  if (find) {
    return find[1]
      .replace(/^(?:customers?|clients?|leads?)\s+/i, "")
      .replace(/^(?:named|called)\s+/i, "")
      .replace(/[?.!]/g, "")
      .trim();
  }
  return "";
}

async function snapshot() {
  const data = await runTool("getTravelSummary");
  if (data?.error) return CRM_UNAVAILABLE_TEXT;
  return [
    "**Current CRM snapshot**",
    `* Customers: ${data.total_customers}`,
    `* Leads: ${data.total_leads} (pending ${data.pending_leads})`,
    `* Bookings: ${data.total_bookings} (pending ${data.pending_bookings})`,
    `* Follow-ups today: ${data.follow_ups_today}`,
    `* Revenue: ${money(data.revenue)}`,
  ].join("\n");
}

const CRM_UNAVAILABLE_TEXT = "I couldn't access the required CRM information. Please try again.";

async function fallbackAnswer(message) {
  const text = String(message || "").trim();
  const q = text.toLowerCase();

  if (!text) {
    return "Please type a question. I can look up customers, bookings, leads, packages, follow-ups, and revenue, or help with day-to-day travel operations.";
  }

  if (/^(hi|hello|hey|salam|assalam|good morning|good afternoon|good evening)\b/.test(q)) {
    return "Hello. I am your travel CRM assistant. Ask me anything — for example today's summary, a customer name, pending leads, revenue, or help writing a follow-up message.";
  }

  if (looksLike(q, ["what can you", "help me", "how do you work", "who are you"])) {
    return [
      "I am the AI Travel Assistant for this CRM. Ask me anything.",
      "",
      "I can:",
      "* Look up live customers, leads, bookings, packages and follow-ups",
      "* Summarize revenue and today's operations",
      "* Help draft messages or next steps for your team",
      "",
      "Try: \"Show pending leads\" or \"Find Muhammad Yousuf\".",
    ].join("\n");
  }

  if (looksLike(q, ["write", "draft", "email", "whatsapp", "compose"])) {
    return [
      "I can help you draft that. Here is a short template you can send:",
      "",
      "\"Hello, this is MIA Holidays. I wanted to follow up on your travel enquiry. Please let us know your preferred dates and destination so we can share the best package.\"",
      "",
      "Tell me the customer name if you want this tailored from CRM records.",
    ].join("\n");
  }

  if (looksLike(q, ["today's travel", "today’s travel", "operations summary", "today's summary", "today’s summary", "crm summary", "what is going on", "status today"])) {
    const data = await runTool("getTravelSummary");
    if (data?.error) return CRM_UNAVAILABLE_TEXT;
    return [
      "**Today's CRM Summary**",
      `* New Leads: ${data.new_leads_today}`,
      `* New Customers: ${data.new_customers_today}`,
      `* Upcoming Bookings: ${data.upcoming_bookings?.length || 0}`,
      `* Pending Bookings: ${data.pending_bookings}`,
      `* Follow-ups: ${data.follow_ups_today}`,
      `* Revenue: ${money(data.revenue)}`,
      `* Trips today: ${data.trips_today}`,
      `* Trips this week: ${data.upcoming_this_week}`,
    ].join("\n");
  }

  if (looksLike(q, ["upcoming booking", "upcoming trip", "travelling soon", "traveling soon", "who is travelling", "who is traveling", "next week", "coming trip"])) {
    const weekly = looksLike(q, ["week"]);
    const data = await runTool(weekly ? "getBookings" : "getUpcomingBookings", weekly ? { timeframe: "this_week" } : {});
    if (data?.error) return CRM_UNAVAILABLE_TEXT;
    if (!data.results?.length) return none();
    return `**Upcoming Bookings**\n\n${table(
      ["Customer", "Destination", "Travel Date", "Status"],
      data.results.map((row) => [row.customer, row.destination || row.package_name, row.departure_date, row.status])
    )}`;
  }

  if (/\bleads?\b/.test(q) || looksLike(q, ["pipeline", "prospect"])) {
    const args = {};
    if (looksLike(q, ["converted"])) args.converted = true;
    else if (looksLike(q, ["today"])) args.today = true;
    else if (looksLike(q, ["high"])) args.highPriority = true;
    else if (looksLike(q, ["inactive"])) args.inactiveDays = 14;
    else if (looksLike(q, ["pending", "open", "new"])) args.pending = true;
    const data = await runTool("getLeads", args);
    if (data?.error) return CRM_UNAVAILABLE_TEXT;
    const statusLine = (data.by_status || []).map((s) => `${s.status}: ${s.count}`).join(", ");
    if (!data.results?.length) {
      return `**Leads**\n\nTotal leads: ${data.total_leads}\n${statusLine || none()}`;
    }
    return `**Leads** (total ${data.total_leads}${statusLine ? `; ${statusLine}` : ""})\n\n${table(
      ["Name", "Status", "Destination", "Budget"],
      data.results.map((row) => [row.name, row.status, row.interested_destination, row.budget == null ? "—" : money(row.budget)])
    )}`;
  }

  if (looksLike(q, ["follow-up", "follow up", "followups", "need to call", "should contact"]) && !looksLike(q, ["write", "draft", "email", "compose"])) {
    const data = await runTool("getFollowUps", { when: looksLike(q, ["overdue"]) ? "overdue" : "today" });
    if (data?.error) return CRM_UNAVAILABLE_TEXT;
    const parts = ["**Follow-ups Needed**"];
    if (data.follow_ups?.length) {
      parts.push(table(
        ["Contact", "Date", "Type", "Status"],
        data.follow_ups.map((row) => [row.customer || row.lead_name, row.follow_up_date, row.type, row.status])
      ));
    } else {
      parts.push("No follow-ups are scheduled for today.");
    }
    if (data.inactive_leads?.length) {
      parts.push("\n**Leads not contacted recently**");
      parts.push(table(
        ["Lead", "Status", "Last update"],
        data.inactive_leads.map((row) => [row.name, row.status, row.updated_at])
      ));
    }
    if (data.approaching_trips?.length) {
      parts.push("\n**Customers whose trips are approaching**");
      parts.push(table(
        ["Customer", "Destination", "Travel Date", "Status"],
        data.approaching_trips.map((row) => [row.customer, row.destination, row.departure_date, row.status])
      ));
    }
    return parts.join("\n");
  }

  if (!looksLike(q, ["inventory", "stock", "availability", "hotel", "room", "vehicle", "seat"]) && looksLike(q, ["revenue", "earn", "sales", "average booking", "how much", "income", "profit"])) {
    const data = await runTool("getRevenueSummary");
    if (data?.error) return CRM_UNAVAILABLE_TEXT;
    return [
      "**Revenue Summary**",
      `* Total revenue: ${money(data.total_revenue)}`,
      `* This month: ${money(data.this_month?.revenue)} (${data.this_month?.bookings} bookings)`,
      `* Last month: ${money(data.last_month?.revenue)} (${data.last_month?.bookings} bookings)`,
      `* Average booking value: ${money(data.average_booking_value)}`,
      data.month_change_percent == null ? "* Last month had no confirmed revenue to compare." : `* This month vs last month: ${data.month_change_percent}%`,
      data.top_packages?.length
        ? `\n**Packages by revenue**\n${table(["Package", "Bookings", "Revenue"], data.top_packages.map((row) => [row.name, row.bookings, money(row.revenue)]))}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (looksLike(q, ["inventory", "stock", "availability", "available hotel", "available room", "vehicles", "vehicle", "seats", "restock", "out of stock", "low stock", "running low", "reserved inventory"])) {
    const category = looksLike(q, ["hotel"]) ? "Hotels" : looksLike(q, ["room"]) ? "Rooms" : looksLike(q, ["vehicle"]) ? "Vehicles" : looksLike(q, ["seat", "flight"]) ? "Flights / Seats" : "";
    const mode = looksLike(q, ["low", "running low", "restock", "almost finished"]) ? "low" : looksLike(q, ["out of stock", "out of", "zero"]) ? "out" : looksLike(q, ["reserved"]) ? "reserved" : looksLike(q, ["available", "availability"]) ? "available" : "all";
    const destination = (text.match(/\b(?:in|for)\s+([A-Za-z][A-Za-z .'-]{1,50})[?.!]?$/i) || [])[1] || "";
    const data = await runTool("getInventory", { category, mode, destination });
    if (data?.error) return CRM_UNAVAILABLE_TEXT;
    if (!data.results?.length && (category || mode !== "all" || destination)) return none();
    const heading = mode === "low" ? "**Low Inventory**" : mode === "out" ? "**Out of Stock Inventory**" : "**Inventory Summary**";
    const summary = [`* Total Items: ${data.total_items}`, `* Available: ${data.available}`, `* Reserved: ${data.reserved}`, `* Low Availability: ${data.low_items}`, `* Out of Stock: ${data.out_items}`].join("\n");
    const list = data.results?.length ? `\n\n${table(["Item", "Category", "Destination", "Available", "Reserved", "Status"], data.results.map((row) => [row.name, row.category, row.destination, row.available_quantity, row.reserved_quantity, row.status.replaceAll("_", " ")]))}` : "";
    return `${heading}\n${summary}${list}`;
  }

  if (looksLike(q, ["package", "destination", "popular", "tour", "offer"])) {
    const data = await runTool("getPackages", { lowBookings: looksLike(q, ["low"]) });
    if (data?.error) return CRM_UNAVAILABLE_TEXT;
    if (!data.packages?.length) return none();
    return [
      "**Packages**",
      table(
        ["Package", "Destination", "Bookings", "Revenue", "Status"],
        data.packages.map((row) => [row.name, row.destination, row.booking_count, money(row.revenue), row.status])
      ),
      data.popular_destinations?.length
        ? `\n**Popular destinations**\n${table(["Destination", "Country", "Bookings"], data.popular_destinations.map((row) => [row.name, row.country, row.bookings]))}`
        : "",
    ].join("\n");
  }

  if (looksLike(q, ["customer", "client", "find ", "who is ", "search", "how many customer", "how many client"])) {
    const query = extractName(text);
    const data = query.length >= 2
      ? await runTool("searchCustomer", { query })
      : await runTool("getCustomers", {
          recentlyDays: looksLike(q, ["recent"]) ? 30 : undefined,
          withUpcomingTrips: looksLike(q, ["upcoming", "trip"]),
          withoutRecentBookings: looksLike(q, ["not booked", "haven't booked", "have not booked"]),
        });
    if (data?.error) return CRM_UNAVAILABLE_TEXT;
    const results = data.results || [];
    if (!results.length) return none();
    const heading = data.total_customers != null ? `**Customers** (total ${data.total_customers})` : "**Customers**";
    return `${heading}\n\n${table(
      ["Name", "Email", "Phone", "Destination"],
      results.map((row) => [row.full_name, row.email, row.phone, row.preferred_destination])
    )}`;
  }

  if (looksLike(q, ["booking", "cancelled", "pending booking", "today's booking", "trip"])) {
    const timeframe = looksLike(q, ["cancel"])
      ? "cancelled"
      : looksLike(q, ["pending"])
        ? "pending"
        : looksLike(q, ["today"])
          ? "today"
          : looksLike(q, ["upcoming", "soon"])
            ? "upcoming"
            : "all";
    const data = await runTool("getBookings", { timeframe });
    if (data?.error) return CRM_UNAVAILABLE_TEXT;
    if (!data.results?.length) return none();
    return `**Bookings** (total ${data.total_bookings})\n\n${table(
      ["Customer", "Destination", "Travel Date", "Status"],
      data.results.map((row) => [row.customer, row.destination || row.package_name, row.departure_date, row.status])
    )}`;
  }

  const maybeName = extractName(text);
  if (maybeName.length >= 2) {
    const found = await runTool("searchCustomer", { query: maybeName });
    if (found?.results?.length) {
      return `**Customers**\n\n${table(
        ["Name", "Email", "Phone", "Destination"],
        found.results.map((row) => [row.full_name, row.email, row.phone, row.preferred_destination])
      )}`;
    }
    const byBooking = await runTool("getBookings", { customerName: maybeName, timeframe: "all" });
    if (byBooking?.results?.length) {
      return `**Bookings**\n\n${table(
        ["Customer", "Destination", "Travel Date", "Status"],
        byBooking.results.map((row) => [row.customer, row.destination || row.package_name, row.departure_date, row.status])
      )}`;
    }
  }

  const live = await snapshot().catch(() => null);
  return [
    "Yes — ask me anything about your travel operations.",
    "",
    live || "I can look up customers, bookings, leads, packages, follow-ups and revenue from the live CRM.",
    "",
    "You can also ask for a name lookup, today's summary, pending leads, or help writing a follow-up.",
  ].join("\n");
}

module.exports = { fallbackAnswer };
