const { runTool } = require("../services/aiCrmTools");
const { fallbackAnswer } = require("../services/aiFallback");

const AI_UNAVAILABLE = "AI assistant is temporarily unavailable. Please try again.";
const CRM_UNAVAILABLE = "I couldn't access the required CRM information. Please try again.";
const MAX_MESSAGE = 2000;
const MAX_HISTORY = 12;
const hits = new Map();

function clientKey(req) {
  return req.ip || req.headers["x-forwarded-for"] || "local";
}

function rateLimited(req) {
  const key = String(clientKey(req));
  const now = Date.now();
  const windowMs = 60 * 1000;
  const current = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (current.length >= 20) {
    hits.set(key, current);
    return true;
  }
  current.push(now);
  hits.set(key, current);
  return false;
}

function cleanHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .slice(-MAX_HISTORY)
    .map((item) => ({
      role: item?.role === "assistant" ? "assistant" : "user",
      content: String(item?.content || "").trim().slice(0, MAX_MESSAGE),
    }))
    .filter((item) => item.content);
}

const tools = [
  {
    type: "function",
    function: {
      name: "getCustomers",
      description: "List or filter CRM customers/clients. Use for counts, recent customers, customers with upcoming trips, or customers without recent bookings.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Optional name, email, or phone search" },
          recentlyDays: { type: "integer", description: "Only customers created in the last N days" },
          withoutRecentBookings: { type: "boolean" },
          withUpcomingTrips: { type: "boolean" },
          limit: { type: "integer" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "searchCustomer",
      description: "Find a specific customer by name, phone, or email and include their travel/booking history.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getLeads",
      description: "Retrieve CRM leads and pipeline information: pending, open, converted, today's leads, high-priority, or inactive leads.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["new", "contacted", "qualified", "converted", "lost"] },
          today: { type: "boolean" },
          pending: { type: "boolean" },
          openOnly: { type: "boolean" },
          converted: { type: "boolean" },
          highPriority: { type: "boolean" },
          inactiveDays: { type: "integer" },
          limit: { type: "integer" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getBookings",
      description: "Retrieve bookings filtered by status, timeframe, or customer name. Timeframes: today, upcoming, this_week, pending, cancelled, needs_attention, all.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["pending", "confirmed", "processing", "cancelled", "completed"] },
          timeframe: { type: "string", enum: ["today", "upcoming", "this_week", "pending", "cancelled", "needs_attention", "all"] },
          customerName: { type: "string" },
          limit: { type: "integer" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getUpcomingBookings",
      description: "Upcoming trips and bookings with departure dates today or later.",
      parameters: {
        type: "object",
        properties: { limit: { type: "integer" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getPackages",
      description: "Travel packages, destinations, booking counts, and package performance.",
      parameters: {
        type: "object",
        properties: {
          lowBookings: { type: "boolean" },
          limit: { type: "integer" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getRevenueSummary",
      description: "Revenue totals, this month vs last month, average booking value, monthly trend, top packages and top customers by booking value.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "getFollowUps",
      description: "Follow-ups due today, overdue, upcoming, inactive leads, and customers with approaching trips.",
      parameters: {
        type: "object",
        properties: {
          when: { type: "string", enum: ["today", "upcoming", "overdue", "all"] },
          status: { type: "string" },
          limit: { type: "integer" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getTravelSummary",
      description: "Today's operational CRM snapshot: new leads/customers, pending items, follow-ups, revenue, and upcoming trips.",
      parameters: { type: "object", properties: {} },
    },
  },
];

const SYSTEM_PROMPT = `You are the admin's AI assistant for this travel agency CRM.
Answer any question the admin asks. Be helpful, concise, and professional.

When the question is about this CRM (customers, clients, leads, bookings, packages, destinations, follow-ups, revenue, trips, or operations):
- Call tools first and use only that live data.
- If tools return no matching records, say: I couldn't find that information in the CRM.
- If a tool returns error crm_unavailable, say: I couldn't access the required CRM information. Please try again.
- Never invent customers, bookings, revenue, destinations, packages, dates, payments, or leads.

When the question is general (writing, ideas, explanations, advice, greetings, or anything else):
- Answer it directly. Do not refuse. Do not say you can only help with CRM.

You are read-only for CRM records. Never claim you created, updated, or deleted data.
Do not mention tool names, SQL, API keys, or internal errors.
For CRM lists, use a markdown table. For CRM summaries, use short bullets.
Currency is USD unless the data indicates otherwise.`;

async function openaiRequest(payload, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) {
      await response.text().catch(() => "");
      console.error("OpenAI request failed", response.status);
      const err = new Error("openai_unavailable");
      err.status = 503;
      throw err;
    }
    return response.json();
  } catch (err) {
    if (err.status === 503) throw err;
    const wrapped = new Error("openai_unavailable");
    wrapped.status = 503;
    throw wrapped;
  } finally {
    clearTimeout(timer);
  }
}

async function chat(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: AI_UNAVAILABLE });
    }
    if (rateLimited(req)) {
      return res.status(429).json({ message: "Too many questions. Please wait a moment and try again." });
    }
    if (!process.env.OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY is not set");
      return res.status(503).json({ message: AI_UNAVAILABLE });
    }

    const message = String(req.body?.message || "").trim();
    if (!message) {
      return res.status(400).json({ message: "Please enter a question." });
    }
    if (message.length > MAX_MESSAGE) {
      return res.status(400).json({ message: "Please shorten your question." });
    }

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...cleanHistory(req.body?.history),
      { role: "user", content: message },
    ];

    let reply = "";
    let crmFailed = false;

    for (let step = 0; step < 4; step += 1) {
      const data = await openaiRequest(
        {
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
          temperature: 0.3,
          messages,
          tools,
          tool_choice: "auto",
        },
        step === 0 ? 18000 : 12000
      );
      const choice = data?.choices?.[0]?.message;
      if (!choice) {
        break;
      }

      if (choice.tool_calls?.length) {
        messages.push({
          role: "assistant",
          content: choice.content || "",
          tool_calls: choice.tool_calls,
        });
        for (const call of choice.tool_calls) {
          let args = {};
          try {
            args = JSON.parse(call.function?.arguments || "{}");
          } catch {
            args = {};
          }
          const result = await runTool(call.function?.name, args);
          if (result?.error === "crm_unavailable") crmFailed = true;
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify(result).slice(0, 8000),
          });
        }
        continue;
      }

      reply = String(choice.content || "").trim();
      break;
    }

    if (crmFailed && !reply) {
      return res.json({ reply: CRM_UNAVAILABLE });
    }
    if (!reply) {
      const fallback = await fallbackAnswer(message);
      return res.json({ reply: fallback });
    }
    return res.json({ reply });
  } catch (err) {
    const fallback = await fallbackAnswer(String(req.body?.message || "")).catch(() => null);
    return res.json({
      reply: fallback || AI_UNAVAILABLE,
    });
  }
}

module.exports = { chat };
