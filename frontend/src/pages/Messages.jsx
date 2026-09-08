import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import api, { formatDate } from "../api/client";
import { useDebounce } from "../hooks/useDebounce";
import { useUi } from "../context/UiContext";
import { EmptyState, Loader, initials } from "../components/ui/Common";

export default function Messages() {
  const { openModal, invalidateAll } = useUi();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(null);
  const [body, setBody] = useState("");
  const debounced = useDebounce(q);
  const conversations = useQuery({
    queryKey: ["conversations", debounced],
    queryFn: async () => (await api.get("/messages/conversations", { params: { q: debounced } })).data,
  });
  const thread = useQuery({
    queryKey: ["thread", active],
    enabled: Boolean(active),
    queryFn: async () => (await api.get(`/messages/conversations/${active}`)).data,
  });
  const send = useMutation({
    mutationFn: () => api.post("/messages", { conversation_id: active, body }),
    onSuccess: () => {
      setBody("");
      invalidateAll();
    },
  });

  const showThread = Boolean(active);

  return (
    <div className="grid min-h-[70vh] overflow-hidden rounded-2xl bg-white shadow-card lg:grid-cols-[minmax(240px,320px)_minmax(0,1fr)]">
      <aside className={`${showThread ? "hidden lg:flex" : "flex"} min-w-0 flex-col border-b border-slate-100 lg:border-b-0 lg:border-r`}>
        <div className="flex items-center justify-between gap-2 px-4 py-4">
          <h1 className="font-extrabold">Messages</h1>
          <button className="btn-primary !py-1.5 !text-xs" onClick={() => openModal("message")}>New</button>
        </div>
        <div className="px-4 pb-3">
          <input className="input" placeholder="Search conversations..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {conversations.isPending && !conversations.data ? <Loader /> : !conversations.data?.length ? (
          <EmptyState title="No conversations yet" hint="Messages stay empty until you send one. Ready for WhatsApp/API later." />
        ) : (
          <div className="max-h-[58vh] overflow-y-auto lg:max-h-none lg:flex-1">
            {conversations.data.map((c) => (
              <button
                key={c.id}
                onClick={() => setActive(c.id)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 ${active === c.id ? "bg-brand-50" : ""}`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                  {initials(c.client_name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-bold">{c.client_name || "Unknown client"}</p>
                    {Number(c.unread_count) > 0 && (
                      <span className="rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">{c.unread_count}</span>
                    )}
                  </div>
                  <p className="truncate text-xs text-slate-400">{c.last_message || "No messages"}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </aside>
      <section className={`${showThread ? "flex" : "hidden lg:flex"} min-h-[420px] min-w-0 flex-col`}>
        {!active ? (
          <div className="grid flex-1 place-items-center px-4">
            <EmptyState title="Select a conversation" hint="Or start one with Send Message." />
          </div>
        ) : thread.isPending && !thread.data ? (
          <Loader />
        ) : (
          <>
            <div className="flex items-start gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
              <button
                className="mt-0.5 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden"
                onClick={() => setActive(null)}
                aria-label="Back to conversations"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="min-w-0">
                <p className="truncate font-bold">{thread.data.conversation.client_name}</p>
                <p className="truncate text-xs text-slate-400">{thread.data.conversation.client_phone || thread.data.conversation.client_email} · {thread.data.conversation.channel}</p>
              </div>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
              {thread.data.messages.map((m) => (
                <div key={m.id} className={`max-w-[85%] break-words rounded-2xl px-4 py-2 text-sm ${m.sender_type === "user" ? "ml-auto bg-brand-600 text-white" : "bg-slate-100 text-slate-700"}`}>
                  <p>{m.body}</p>
                  <p className={`mt-1 text-[10px] ${m.sender_type === "user" ? "text-white/70" : "text-slate-400"}`}>{formatDate(m.created_at)}</p>
                </div>
              ))}
            </div>
            <form
              className="flex flex-col gap-2 border-t border-slate-100 p-3 sm:flex-row sm:p-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!body.trim()) return;
                send.mutate();
              }}
            >
              <input className="input min-w-0" placeholder="Write a message..." value={body} onChange={(e) => setBody(e.target.value)} />
              <button className="btn-primary sm:shrink-0" disabled={send.isPending}>Send</button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
