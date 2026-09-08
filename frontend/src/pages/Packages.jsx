import { useState } from "react";
import { Eye, Pencil, Plus, Power, Trash2 } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import api, { money } from "../api/client";
import { useDebounce } from "../hooks/useDebounce";
import { useUi } from "../context/UiContext";
import { EmptyState, Loader, Pagination, StatusBadge } from "../components/ui/Common";

export default function Packages() {
  const { openModal, askConfirm, invalidateAll } = useUi();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const debounced = useDebounce(q);
  const list = useQuery({
    queryKey: ["packages", debounced, page],
    queryFn: async () => (await api.get("/packages", { params: { q: debounced, page, limit: 8 } })).data,
  });
  const toggle = useMutation({
    mutationFn: (pkg) => api.patch(`/packages/${pkg.id}/status`, { status: pkg.status === "active" ? "inactive" : "active" }),
    onSuccess: () => invalidateAll(),
  });

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-extrabold">Travel Packages</h1>
          <p className="text-xs text-slate-400">Catalog stored in MySQL with optional images</p>
        </div>
        <div className="page-head-actions">
          <input className="input sm:!w-56" placeholder="Search packages..." value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          <button className="btn-primary" onClick={() => openModal("package")}><Plus className="h-4 w-4" /> Create Package</button>
        </div>
      </div>
      {list.isPending && !list.data ? (
        <div className="card"><Loader /></div>
      ) : !list.data?.data?.length ? (
        <div className="card"><EmptyState title="No travel packages yet" hint="Create a package to start selling trips." /></div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {list.data.data.map((p) => (
              <div key={p.id} className="card overflow-hidden">
                <div className="h-32 bg-slate-100">
                  {p.image ? <img src={p.image} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-xs text-slate-400">No image</div>}
                </div>
                <div className="p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="truncate font-bold">{p.name}</p>
                    <StatusBadge value={p.status} />
                  </div>
                  <p className="text-xs text-slate-400">{p.category} · {p.destination_name || "No destination"}</p>
                  <p className="mt-2 text-lg font-extrabold text-brand-600">{money(p.price)}</p>
                  <p className="text-xs text-slate-400">{p.duration || "Duration not set"}</p>
                  <div className="mt-3 flex gap-1">
                    <button className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" onClick={() => openModal("view-package", p)}><Eye className="h-4 w-4" /></button>
                    <button className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" onClick={() => openModal("package", p)}><Pencil className="h-4 w-4" /></button>
                    <button className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" onClick={() => toggle.mutate(p)}><Power className="h-4 w-4" /></button>
                    <button
                      className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                      onClick={() =>
                        askConfirm({
                          title: "Delete package",
                          message: `${p.name} will be deleted from MySQL. Existing bookings will keep their history without this package link.`,
                          onConfirm: () => api.delete(`/packages/${p.id}`),
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="card mt-4">
            <Pagination page={page} limit={8} total={list.data.total} onPage={setPage} />
          </div>
        </>
      )}
    </div>
  );
}
