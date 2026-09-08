import { useState } from "react";
import { Eye, Pencil, Plus, Trash2, UserPlus } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import api, { formatDate, money } from "../api/client";
import { useDebounce } from "../hooks/useDebounce";
import { useUi } from "../context/UiContext";
import { EmptyState, Loader, Pagination, StatusBadge } from "../components/ui/Common";

export default function Leads() {
  const { openModal, askConfirm, invalidateAll, toast } = useUi();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const debounced = useDebounce(q);
  const agents = useQuery({ queryKey: ["agents"], queryFn: async () => (await api.get("/agents")).data });
  const list = useQuery({
    queryKey: ["leads", debounced, status, page],
    queryFn: async () => (await api.get("/leads", { params: { q: debounced, status: status || undefined, page, limit: 10 } })).data,
  });
  const convert = useMutation({
    mutationFn: (id) => api.post(`/leads/${id}/convert`),
    onSuccess: () => {
      invalidateAll();
      toast("Lead converted to client");
    },
  });
  const assign = useMutation({
    mutationFn: ({ id, assigned_agent_id, status }) => api.patch(`/leads/${id}`, { assigned_agent_id, status }),
    onSuccess: () => invalidateAll(),
  });

  return (
    <div className="card overflow-hidden">
      <div className="page-head">
        <div>
          <h1 className="text-lg font-extrabold">Leads</h1>
          <p className="text-xs text-slate-400">Capture enquiries and convert them into clients</p>
        </div>
        <div className="page-head-actions">
          <input className="input sm:!w-48" placeholder="Search leads..." value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          <select className="input min-[420px]:!w-40" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            {["new", "contacted", "qualified", "converted", "lost"].map((s) => <option key={s}>{s}</option>)}
          </select>
          <button className="btn-primary" onClick={() => openModal("lead")}><Plus className="h-4 w-4" /> Add Lead</button>
        </div>
      </div>
      {list.isPending && !list.data ? <Loader /> : !list.data?.data?.length ? (
        <EmptyState title="No leads yet" hint="Add a lead when someone enquires about a trip." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-5 py-3">Lead</th>
                <th className="px-5 py-3">Destination</th>
                <th className="px-5 py-3">Budget</th>
                <th className="px-5 py-3">Travel date</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Agent</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.data.data.map((l) => (
                <tr key={l.id} className="border-t border-slate-50">
                  <td className="px-5 py-3">
                    <p className="font-semibold">{l.name}</p>
                    <p className="text-xs text-slate-400">{l.phone} · {l.source || "No source"}</p>
                  </td>
                  <td className="px-5 py-3">{l.destination_name || "—"}</td>
                  <td className="px-5 py-3">{l.budget ? money(l.budget) : "—"}</td>
                  <td className="px-5 py-3">{formatDate(l.travel_date)}</td>
                  <td className="px-5 py-3">
                    <select className="input !py-1 !text-xs" value={l.status} onChange={(e) => assign.mutate({ id: l.id, status: e.target.value, assigned_agent_id: l.assigned_agent_id })}>
                      {["new", "contacted", "qualified", "converted", "lost"].map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-5 py-3">
                    <select className="input !py-1 !text-xs" value={l.assigned_agent_id || ""} onChange={(e) => assign.mutate({ id: l.id, assigned_agent_id: e.target.value || null, status: l.status })}>
                      <option value="">Unassigned</option>
                      {(agents.data || []).map((a) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
                    </select>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-1">
                      <button className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" onClick={() => openModal("view-lead", l)}><Eye className="h-4 w-4" /></button>
                      <button className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" onClick={() => openModal("lead", l)}><Pencil className="h-4 w-4" /></button>
                      {l.status !== "converted" && (
                        <button className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50" title="Convert to client" onClick={() => convert.mutate(l.id)}>
                          <UserPlus className="h-4 w-4" />
                        </button>
                      )}
                      <button className="rounded-lg p-1.5 text-brand-600 hover:bg-brand-50" title="Add follow-up" onClick={() => openModal("followup", { lead_id: l.id })}>+</button>
                      <button
                        className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                        onClick={() =>
                          askConfirm({
                            title: "Delete lead",
                            message: `${l.name} will be deleted from MySQL along with related follow-ups.`,
                            onConfirm: () => api.delete(`/leads/${l.id}`),
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
