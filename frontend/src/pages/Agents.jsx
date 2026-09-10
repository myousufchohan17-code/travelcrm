import { useState } from "react";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import api, { errorMessage } from "../api/client";
import { useUi } from "../context/UiContext";
import { EmptyState, Loader, Modal, StatusBadge, initials } from "../components/ui/Common";

export default function Agents() {
  const { askConfirm, invalidateAll, toast } = useUi();
  const [modal, setModal] = useState(null);
  const list = useQuery({ queryKey: ["agents"], queryFn: async () => (await api.get("/agents")).data });

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-extrabold">Assigned Agents</h1>
          <p className="text-xs text-slate-400">Manage agents and assign them to bookings and leads</p>
        </div>
        <button className="btn-primary w-full shrink-0 sm:w-auto" onClick={() => setModal({ full_name: "", email: "", phone: "", status: "active" })}>
          <Plus className="h-4 w-4" /> Add Agent
        </button>
      </div>
      {list.isPending && !list.data ? (
        <div className="card"><Loader /></div>
      ) : !list.data?.length ? (
        <div className="card"><EmptyState title="No agents yet" hint="Add an agent, then assign them on bookings and leads." /></div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {list.data.map((a) => (
            <div key={a.id} className="card overflow-hidden">
              <div className="h-36 bg-slate-100">
                {a.image ? (
                  <img src={a.image} alt="" className="h-full w-full max-w-none object-cover" />
                ) : (
                  <div className="grid h-full place-items-center bg-brand-50 text-2xl font-extrabold text-brand-700">{initials(a.full_name)}</div>
                )}
              </div>
              <div className="p-4">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-bold">{a.full_name}</p>
                    <p className="truncate text-xs text-slate-400">{a.email || a.phone || "No contact"}</p>
                  </div>
                  <StatusBadge value={a.status} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-xl bg-slate-50 py-2">
                    <p className="text-lg font-extrabold text-slate-800">{Number(a.assigned_bookings) || 0}</p>
                    <p className="text-[10px] text-slate-400">Bookings</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 py-2">
                    <p className="text-lg font-extrabold text-slate-800">{Number(a.assigned_leads) || 0}</p>
                    <p className="text-[10px] text-slate-400">Leads</p>
                  </div>
                </div>
                <div className="mt-3 flex gap-1">
                  <button className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" onClick={() => setModal({ ...a, _view: true })}><Eye className="h-4 w-4" /></button>
                  <button className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" onClick={() => setModal(a)}><Pencil className="h-4 w-4" /></button>
                  <button
                    className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                    onClick={() =>
                      askConfirm({
                        title: "Delete agent",
                        message: `${a.full_name} will be deleted. Assigned bookings and leads will become unassigned.`,
                        onConfirm: async () => {
                          await api.delete(`/agents/${a.id}`);
                          invalidateAll();
                        },
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
      )}
      {modal?._view && (
        <Modal title="Agent details" onClose={() => setModal(null)}>
          {modal.image ? <img src={modal.image} alt="" className="mb-4 h-40 w-full rounded-xl object-cover" /> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <Info label="Name" value={modal.full_name} />
            <Info label="Status" value={modal.status} />
            <Info label="Email" value={modal.email} />
            <Info label="Phone" value={modal.phone} />
            <Info label="Assigned bookings" value={modal.assigned_bookings} />
            <Info label="Assigned leads" value={modal.assigned_leads} />
          </div>
        </Modal>
      )}
      {modal && !modal._view && (
        <AgentFormModal
          initial={modal}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            invalidateAll();
            toast("Agent saved");
          }}
        />
      )}
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-medium capitalize text-slate-700">{value || "—"}</p>
    </div>
  );
}

function AgentFormModal({ initial, onClose, onSaved }) {
  const { toast } = useUi();
  const [form, setForm] = useState(initial);
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const fd = new FormData();
    fd.append("full_name", form.full_name || "");
    fd.append("email", form.email || "");
    fd.append("phone", form.phone || "");
    fd.append("status", form.status || "active");
    if (file) fd.append("image", file);
    setSaving(true);
    try {
      if (initial.id) await api.put(`/agents/${initial.id}`, fd);
      else await api.post("/agents", fd);
      onSaved();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={initial.id ? "Edit agent" : "Add agent"} onClose={onClose}>
      <form className="space-y-3" onSubmit={submit}>
        <div><label className="label">Name *</label><input className="input" required value={form.full_name || ""} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
        <div><label className="label">Email</label><input className="input" type="email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div><label className="label">Phone</label><input className="input" value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        <div>
          <label className="label">Status</label>
          <select className="input" value={form.status || "active"} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div>
          <label className="label">Photo</label>
          <input className="input" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </div>
        <div className="flex justify-end"><button className="btn-primary" disabled={saving}>{saving ? "Saving..." : "Save Agent"}</button></div>
      </form>
    </Modal>
  );
}
