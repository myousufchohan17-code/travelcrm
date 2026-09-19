import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3, Bot, CalendarCheck, Clock3, Eraser, MapPin, Package,
  Plus, Send, Sparkles, Target, Users,
} from "lucide-react";
import api from "../api/client";

const STORAGE_KEY = "travelcrm-ai-chat";
const QUICK = [
  { label: "Today's Summary", prompt: "Give me today's travel operations summary.", icon: Sparkles },
  { label: "Upcoming Bookings", prompt: "Show upcoming bookings.", icon: CalendarCheck },
  { label: "Pending Leads", prompt: "Which leads are pending?", icon: Target },
  { label: "Follow-ups Needed", prompt: "Who needs follow-up today? Also list overdue follow-ups and customers the sales team should contact.", icon: Clock3 },
  { label: "Revenue Summary", prompt: "What is our total revenue, this month's revenue, last month's revenue, and the average booking value?", icon: BarChart3 },
  { label: "Popular Packages", prompt: "Which packages and destinations are most popular, and which packages have low bookings?", icon: Package },
  { label: "Customer Overview", prompt: "How many customers do we have, and show customers added recently.", icon: Users },
  { label: "Upcoming Trips", prompt: "What trips are coming up this week, and which customers are travelling soon?", icon: MapPin },
];

function nowStamp() {
  return new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadChat() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (raw?.messages && Array.isArray(raw.messages)) return raw;
  } catch {
    /* ignore */
  }
  return { id: newId(), messages: [] };
}

function inlineFormat(text) {
  const parts = [];
  const regex = /\*\*(.+?)\*\*/g;
  let last = 0;
  let match;
  while ((match = regex.exec(text))) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    parts.push(<strong key={match.index}>{match[1]}</strong>);
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function AiMarkdown({ text }) {
  const blocks = [];
  const lines = String(text || "").split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim().startsWith("|")) {
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const cells = lines[i]
          .trim()
          .replace(/^\|/, "")
          .replace(/\|$/, "")
          .split("|")
          .map((c) => c.trim());
        if (!cells.every((c) => /^:?-{3,}:?$/.test(c))) rows.push(cells);
        i += 1;
      }
      if (rows.length) {
        const header = rows[0];
        const body = rows.slice(1);
        blocks.push(
          <div key={`t-${i}`} className="my-2 max-w-full overflow-x-auto rounded-xl border border-slate-100 bg-white">
            <table className="min-w-[420px] w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400">
                <tr>
                  {header.map((cell, hi) => (
                    <th key={`${cell}-${hi}`} className="whitespace-nowrap px-3 py-2 font-semibold">{cell}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {body.map((row, ri) => (
                  <tr key={ri} className="border-t border-slate-50">
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-3 py-2 text-slate-700">{inlineFormat(cell)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      continue;
    }
    if (/^\s*[-*•]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*•]\s+/, ""));
        i += 1;
      }
      blocks.push(
        <ul key={`l-${i}`} className="my-1 list-disc space-y-1 pl-5 text-sm">
          {items.map((item, idx) => (
            <li key={idx}>{inlineFormat(item)}</li>
          ))}
        </ul>
      );
      continue;
    }
    if (line.trim()) {
      blocks.push(
        <p key={`p-${i}`} className="my-1 text-sm leading-6">
          {inlineFormat(line)}
        </p>
      );
    } else {
      blocks.push(<div key={`s-${i}`} className="h-2" />);
    }
    i += 1;
  }
  return <div className="min-w-0">{blocks}</div>;
}

function QuickChips({ onPick, disabled, compact }) {
  return (
    <div className={`flex gap-2 ${compact ? "overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible" : "flex-wrap justify-center"}`}>
      {QUICK.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.label}
            type="button"
            disabled={disabled}
            onClick={() => onPick(item.prompt)}
            className="ai-chip"
          >
            <Icon className="h-3.5 w-3.5 shrink-0 text-brand-500" />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export default function AiAssistant() {
  const [chat, setChat] = useState(loadChat);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const empty = !chat.messages.length && !sending;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chat));
  }, [chat]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.messages, sending]);

  const history = useMemo(
    () => chat.messages.map((m) => ({ role: m.role, content: m.content })),
    [chat.messages]
  );

  async function send(text) {
    const message = String(text || input).trim();
    if (!message || sending) return;
    setError("");
    setInput("");
    const userMsg = { id: newId(), role: "user", content: message, at: nowStamp() };
    setChat((prev) => ({ ...prev, messages: [...prev.messages, userMsg] }));
    setSending(true);
    try {
      const { data } = await api.post(
        "/ai/travel-assistant",
        { message, history },
        { timeout: 28000 }
      );
      const reply = data?.reply || "I couldn't find that information in the CRM.";
      setChat((prev) => ({
        ...prev,
        messages: [...prev.messages, { id: newId(), role: "assistant", content: reply, at: nowStamp() }],
      }));
    } catch (err) {
      const status = err?.response?.status;
      const msg =
        err?.code === "ECONNABORTED" || err?.message?.includes("timeout")
          ? "AI assistant is temporarily unavailable. Please try again."
          : status === 429
            ? "Too many questions. Please wait a moment and try again."
            : err?.response?.data?.message || "AI assistant is temporarily unavailable. Please try again.";
      setError(msg);
      setChat((prev) => ({
        ...prev,
        messages: [...prev.messages, { id: newId(), role: "assistant", content: msg, at: nowStamp(), error: true }],
      }));
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function newChat() {
    setError("");
    setChat({ id: newId(), messages: [] });
    inputRef.current?.focus();
  }

  function clearChat() {
    setError("");
    setChat((prev) => ({ ...prev, messages: [] }));
  }

  return (
    <div className="ai-page">
      <div className="ai-page-header flex flex-col gap-3 px-4 py-4 text-white sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
            <Sparkles className="h-5 w-5 text-blue-200" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/55">Travel CRM</p>
            <h1 className="text-lg font-extrabold tracking-tight sm:text-xl">AI Travel Assistant</h1>
            <p className="mt-1 max-w-xl text-xs leading-5 text-white/70">
              Your intelligent assistant for travel operations, customers, bookings and sales.
            </p>
          </div>
        </div>
        <div className="flex w-full min-w-0 gap-2 sm:w-auto">
          <button
            type="button"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2.5 text-sm font-semibold text-white ring-1 ring-white/10 hover:bg-white/15 disabled:opacity-40 sm:flex-none"
            onClick={clearChat}
            disabled={sending || !chat.messages.length}
          >
            <Eraser className="h-4 w-4" /> Clear Chat
          </button>
          <button
            type="button"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-500 px-3 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-40 sm:flex-none"
            onClick={newChat}
            disabled={sending}
          >
            <Plus className="h-4 w-4" /> New Chat
          </button>
        </div>
      </div>

      <div className="ai-scroll min-h-0 flex-1 overflow-y-auto bg-[#f6f8fc] px-3 py-4 sm:px-6">
        {empty ? (
          <div className="mx-auto flex h-full min-h-[16rem] max-w-2xl flex-col items-center justify-center px-2 py-6 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-soft ring-1 ring-slate-100">
              <Bot className="h-7 w-7 text-brand-600" />
            </div>
            <h2 className="text-base font-extrabold text-slate-800 sm:text-lg">Ask me anything</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
              I answer travel CRM questions from live records, and I can also help with everyday admin questions.
            </p>
            <div className="mt-5 w-full">
              <QuickChips onPick={send} disabled={sending} />
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-4">
            {chat.messages.map((msg) => (
              <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" ? (
                  <span className="mt-1 hidden h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy-900 text-white sm:flex">
                    <Sparkles className="h-3.5 w-3.5" />
                  </span>
                ) : null}
                <div
                  className={`max-w-[92%] min-w-0 px-4 py-3 sm:max-w-[78%] ${
                    msg.role === "user"
                      ? "rounded-2xl rounded-br-md bg-brand-600 text-white shadow-sm"
                      : msg.error
                        ? "rounded-2xl rounded-bl-md border border-red-100 bg-red-50 text-red-700"
                        : "rounded-2xl rounded-bl-md border border-slate-100 bg-white text-slate-700 shadow-soft"
                  }`}
                >
                  {msg.role === "assistant" ? <AiMarkdown text={msg.content} /> : <p className="text-sm leading-6">{msg.content}</p>}
                  <p className={`mt-1.5 text-[10px] font-medium ${msg.role === "user" ? "text-white/65" : "text-slate-400"}`}>{msg.at}</p>
                </div>
              </div>
            ))}
            {sending ? (
              <div className="flex justify-start gap-2">
                <span className="mt-1 hidden h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy-900 text-white sm:flex">
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
                <div className="rounded-2xl rounded-bl-md border border-slate-100 bg-white px-4 py-3 shadow-soft">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-brand-500 [animation-delay:-0.2s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-brand-400 [animation-delay:-0.1s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-brand-300" />
                  </div>
                  <p className="mt-1.5 text-[10px] font-medium text-slate-400">Thinking...</p>
                </div>
              </div>
            ) : null}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="ai-composer border-t border-slate-100 bg-white px-3 py-3 sm:px-6 sm:py-4">
        {error ? <p className="mb-2 text-xs font-medium text-red-500">{error}</p> : null}
        {!empty ? (
          <div className="mb-3">
            <QuickChips onPick={send} disabled={sending} compact />
          </div>
        ) : null}
        <form
          className="flex min-w-0 items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 focus-within:border-brand-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-brand-500/10"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            disabled={sending}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Ask anything — customers, bookings, a name, or help with a message..."
            className="max-h-28 min-h-[44px] min-w-0 flex-1 resize-none bg-transparent px-2 py-2.5 text-sm text-slate-800 outline-none"
          />
          <button
            type="submit"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={sending || !input.trim()}
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
