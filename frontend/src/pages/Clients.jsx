import { useState } from "react";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import api, { formatDate } from "../api/client";
import { useDebounce } from "../hooks/useDebounce";
import { useUi } from "../context/UiContext";
import { EmptyState, Loader, Pagination, initials } from "../components/ui/Common";

export default function Clients() {
  const { openModal, askConfirm } = useUi();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const debounced = useDebounce(q);
  const list = useQuery({
    queryKey: ["clients", debounced, page],
    queryFn: async () => (await api.get("/clients", { params: { q: debounced, page, limit: 10 } })).data,
  });

  return (
    <div className="card overflow-hidden">
      <div className="page-head">
        <div>
          <h1 className="text-lg font-extrabold">Clients</h1>
          <p className="text-xs text-slate-400">All client records stored in MySQL</p>
        </div>
        <div className="page-head-actions">
          <input className="input sm:!w-56" placeholder="Search clients..." value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          <button className="btn-primary" onClick={() => openModal("client")}><Plus className="h-4 w-4" /> Add Client</button>
        </div>
      </div>
      {list.isPending && !list.data ? <Loader /> : !list.data?.data?.length ? (
        <EmptyState title="No clients yet" hint="Use Add Client to create the first record." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-5 py-3">Client</th>
                <th className="px-5 py-3">Phone</th>
                <th className="px-5 py-3">Country</th>
                <th className="px-5 py-3">Destination</th>
                <th className="px-5 py-3">Added</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.data.data.map((c) => (
                <tr key={c.id} className="border-t border-slate-50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">{initials(c.full_name)}</div>
                      <div>
                        <p className="font-semibold">{c.full_name}</p>
                        <p className="text-xs text-slate-400">{c.email || "No email"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">{c.phone}</td>
                  <td className="px-5 py-3">{c.country || "—"}</td>
                  <td className="px-5 py-3">{c.preferred_destination || "—"}</td>
                  <td className="px-5 py-3">{formatDate(c.created_at)}</td>
                  <td className="px-5 py-3">
                    <div className="flex gap-1">
                      <button className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" onClick={() => openModal("view-client", c)}><Eye className="h-4 w-4" /></button>
                      <button className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" onClick={() => openModal("client", c)}><Pencil className="h-4 w-4" /></button>
                      <button
                        className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                        onClick={() =>
                          askConfirm({
                            title: "Delete client",
                            message: `${c.full_name} will be deleted from MySQL. Related follow-ups and conversations will also be removed.`,
                            onConfirm: () => api.delete(`/clients/${c.id}`),
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
