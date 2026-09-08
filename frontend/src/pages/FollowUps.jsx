import { useState } from "react";
import { Check, CalendarClock, Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import api, { formatDate } from "../api/client";
import { useUi } from "../context/UiContext";
import { EmptyState, Loader, Modal, Pagination, StatusBadge } from "../components/ui/Common";

export default function FollowUps() {
  const { openModal, askConfirm, invalidateAll, toast } = useUi();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [reschedule, setReschedule] = useState(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const list = useQuery({
    queryKey: ["follow-ups", status, page],
    queryFn: async () => (await api.get("/follow-ups", { params: { status: status || undefined, page, limit: 10 } })).data,
  });
  const complete = useMutation({
    mutationFn: (id) => api.patch(`/follow-ups/${id}/complete`),
    onSuccess: () => {
      invalidateAll();
      toast("Follow-up completed");
    },
  });
  const doReschedule = useMutation({
    mutationFn: () => api.patch(`/follow-ups/${reschedule.id}/reschedule`, { follow_up_date: date, follow_up_time: time || null }),
    onSuccess: () => {
      invalidateAll();
      toast("Follow-up rescheduled");
      setReschedule(null);
    },
  });

  return (
    <div className="card overflow-hidden">
      <div className="page-head">
        <div>
          <h1 className="text-lg font-extrabold">Follow Ups</h1>
          <p className="text-xs text-slate-400">Schedule, complete and reschedule real follow-ups</p>
        </div>
        <div className="page-head-actions">
          <select className="input min-[420px]:!w-40" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            {["scheduled", "completed", "cancelled", "rescheduled"].map((s) => <option key={s}>{s}</option>)}
          </select>
          <button className="btn-primary" onClick={() => openModal("followup")}><Plus className="h-4 w-4" /> Add Follow-up</button>
        </div>
      </div>
      {list.isPending && !list.data ? <Loader /> : !list.data?.data?.length ? (
        <EmptyState title="No follow-ups yet" hint="Add a follow-up for a lead or client." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-5 py-3">Contact</th>
                <th className="px-5 py-3">When</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Agent</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.data.data.map((f) => (
                <tr key={f.id} className="border-t border-slate-50">
                  <td className="px-5 py-3 font-semibold">{f.client_name || f.lead_name || "—"}</td>
                  <td className="px-5 py-3">{formatDate(f.follow_up_date)} {f.follow_up_time || ""}</td>
                  <td className="px-5 py-3 capitalize">{f.type}</td>
                  <td className="px-5 py-3">{f.agent_name || "Unassigned"}</td>
                  <td className="px-5 py-3"><StatusBadge value={f.status} /></td>
                  <td className="px-5 py-3">
                    <div className="flex gap-1">
                      <button className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" onClick={() => openModal("view-followup", f)}><Eye className="h-4 w-4" /></button>
                      <button className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" onClick={() => openModal("followup", f)}><Pencil className="h-4 w-4" /></button>
                      <button className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50" onClick={() => complete.mutate(f.id)}><Check className="h-4 w-4" /></button>
                      <button className="rounded-lg p-1.5 text-orange-500 hover:bg-orange-50" onClick={() => { setReschedule(f); setDate(f.follow_up_date); setTime(String(f.follow_up_time || "").slice(0, 5)); }}><CalendarClock className="h-4 w-4" /></button>
                      <button
                        className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                        onClick={() =>
                          askConfirm({
                            title: "Delete follow-up",
                            message: "This follow-up will be permanently deleted from MySQL.",
                            onConfirm: () => api.delete(`/follow-ups/${f.id}`),
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {list.data?.data?.length ? (
        <Pagination page={page} limit={10} total={list.data.total} onPage={setPage} />
      ) : null}
      {reschedule && (
        <Modal title="Reschedule follow-up" onClose={() => setReschedule(null)}>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              doReschedule.mutate();
            }}
          >
            <div>
              <label className="label">Date</label>
              <input className="input" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <label className="label">Time</label>
              <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            <div className="flex justify-end">
              <button className="btn-primary" disabled={doReschedule.isPending}>Save</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
