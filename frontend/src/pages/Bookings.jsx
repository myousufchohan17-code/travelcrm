import { useState } from "react";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import api, { formatDate, money } from "../api/client";
import { useDebounce } from "../hooks/useDebounce";
import { useUi } from "../context/UiContext";
import { EmptyState, Loader, Pagination, StatusBadge } from "../components/ui/Common";

const statuses = ["", "pending", "confirmed", "processing", "cancelled", "completed"];

export default function Bookings() {
  const { openModal, askConfirm, invalidateAll, toast } = useUi();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const agents = useQuery({ queryKey: ["agents"], queryFn: async () => (await api.get("/agents")).data });
  const debounced = useDebounce(q);
  const list = useQuery({
    queryKey: ["bookings", debounced, status, page],
    queryFn: async () => (await api.get("/bookings", { params: { q: debounced, status: status || undefined, page, limit: 10 } })).data,
  });
  const patchStatus = useMutation({
    mutationFn: ({ id, status }) => api.patch(`/bookings/${id}/status`, { status }),
    onSuccess: () => invalidateAll(),
  });
  const patchAgent = useMutation({
    mutationFn: ({ id, assigned_agent_id }) => api.patch(`/bookings/${id}/agent`, { assigned_agent_id }),
    onSuccess: () => {
      invalidateAll();
      toast("Agent assigned");
    },
  });

  return (
    <div className="card overflow-hidden">
      <div className="page-head">
        <div>
          <h1 className="text-lg font-extrabold">Bookings</h1>
          <p className="text-xs text-slate-400">Create, update and delete real booking records</p>
        </div>
        <div className="page-head-actions">
          <input className="input sm:!w-48" placeholder="Search bookings..." value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          <select className="input min-[420px]:!w-40" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            {statuses.filter(Boolean).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button className="btn-primary" onClick={() => openModal("booking")}><Plus className="h-4 w-4" /> Add Booking</button>
        </div>
      </div>
      {list.isPending && !list.data ? <Loader /> : !list.data?.data?.length ? (
        <EmptyState title="No bookings yet" hint="Use Add Booking or New Booking to create the first trip." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-5 py-3">Client</th>
                <th className="px-5 py-3">Destination</th>
                <th className="px-5 py-3">Dates</th>
                <th className="px-5 py-3">Amount</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Agent</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.data.data.map((b) => (
                <tr key={b.id} className="border-t border-slate-50">
                  <td className="px-5 py-3 font-semibold">{b.client_name || "—"}</td>
                  <td className="px-5 py-3">{b.destination_name || b.package_name || "—"}</td>
                  <td className="px-5 py-3">{formatDate(b.departure_date)}</td>
                  <td className="px-5 py-3">{money(b.total_amount)}</td>
                  <td className="px-5 py-3">
                    <select
                      className="rounded-full border-0 bg-transparent text-xs font-semibold"
                      value={b.status}
                      onChange={(e) => patchStatus.mutate({ id: b.id, status: e.target.value })}
                    >
                      {statuses.filter(Boolean).map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <div className="mt-1"><StatusBadge value={b.payment_status} /></div>
                  </td>
                  <td className="px-5 py-3">
                    <select
                      className="input !py-1 !text-xs"
                      value={b.assigned_agent_id || ""}
                      onChange={(e) => patchAgent.mutate({ id: b.id, assigned_agent_id: e.target.value || null })}
                    >
                      <option value="">Unassigned</option>
                      {(agents.data || []).map((a) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
                    </select>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-1">
                      <button className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" onClick={() => openModal("view-booking", b)}><Eye className="h-4 w-4" /></button>
                      <button className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" onClick={() => openModal("booking", b)}><Pencil className="h-4 w-4" /></button>
                      <button
                        className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                        onClick={() =>
                          askConfirm({
                            title: "Delete booking",
                            message: "This booking will be permanently deleted from MySQL. Dashboard statistics and charts will update immediately.",
                            onConfirm: () => api.delete(`/bookings/${b.id}`),
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
    </div>
  );
}
