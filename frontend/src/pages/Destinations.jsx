import { useState } from "react";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import api, { errorMessage } from "../api/client";
import { useUi } from "../context/UiContext";
import { EmptyState, Loader, Modal } from "../components/ui/Common";

export default function Destinations() {
  const { askConfirm, invalidateAll, toast } = useUi();
  const [modal, setModal] = useState(null);
  const list = useQuery({ queryKey: ["destinations"], queryFn: async () => (await api.get("/destinations")).data });

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-extrabold">Destinations</h1>
          <p className="text-xs text-slate-400">Add travel destinations with photos used across packages and bookings</p>
        </div>
        <button className="btn-primary w-full shrink-0 sm:w-auto" onClick={() => setModal({})}>
          <Plus className="h-4 w-4" /> Add Destination
        </button>
      </div>
      {list.isPending && !list.data ? (
        <div className="card"><Loader /></div>
      ) : !list.data?.length ? (
        <div className="card"><EmptyState title="No destinations available" hint="Add a destination with an image to use it in packages and bookings." /></div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {list.data.map((d) => (
            <div key={d.id} className="card overflow-hidden">
              <div className="h-40 bg-slate-100">
                {d.image ? (
                  <img src={d.image} alt="" className="h-full w-full max-w-none object-cover" />
                ) : (
                  <div className="grid h-full place-items-center text-xs text-slate-400">No image</div>
                )}
              </div>
              <div className="p-4">
                <p className="truncate font-bold">{d.name}</p>
                <p className="text-xs text-slate-400">{d.country || "Country not set"}</p>
                <p className="mt-2 text-sm font-semibold text-brand-600">{Number(d.bookings) || 0} bookings</p>
                <div className="mt-3 flex gap-1">
                  <button className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" onClick={() => setModal({ ...d, _view: true })}><Eye className="h-4 w-4" /></button>
                  <button className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" onClick={() => setModal(d)}><Pencil className="h-4 w-4" /></button>
                  <button
                    className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                    onClick={() =>
                      askConfirm({
                        title: "Delete destination",
                        message: `${d.name} will be deleted. Related records will keep their history without this destination link.`,
                        onConfirm: async () => {
                          await api.delete(`/destinations/${d.id}`);
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
        <Modal title="Destination details" onClose={() => setModal(null)}>
          {modal.image ? <img src={modal.image} alt="" className="mb-4 h-48 w-full rounded-xl object-cover" /> : null}
          <p className="text-lg font-bold">{modal.name}</p>
          <p className="text-sm text-slate-500">{modal.country || "Country not set"}</p>
          <p className="mt-2 text-sm font-semibold text-brand-600">{Number(modal.bookings) || 0} bookings</p>
        </Modal>
      )}
      {modal && !modal._view && (
        <DestinationFormModal
          initial={modal}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            invalidateAll();
            toast("Destination saved");
          }}
        />
      )}
    </div>
  );
}

function DestinationFormModal({ initial, onClose, onSaved }) {
  const { toast } = useUi();
  const [name, setName] = useState(initial.name || "");
  const [country, setCountry] = useState(initial.country || "");
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const fd = new FormData();
    fd.append("name", name);
    fd.append("country", country);
    if (file) fd.append("image", file);
    setSaving(true);
    try {
      if (initial.id) await api.put(`/destinations/${initial.id}`, fd);
      else await api.post("/destinations", fd);
      onSaved();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={initial.id ? "Edit destination" : "Add destination"} onClose={onClose}>
      <form className="space-y-3" onSubmit={submit}>
        {initial.image && !file ? <img src={initial.image} alt="" className="h-32 w-full rounded-xl object-cover" /> : null}
        <div><label className="label">Name *</label><input className="input" required value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><label className="label">Country</label><input className="input" value={country} onChange={(e) => setCountry(e.target.value)} /></div>
        <div><label className="label">Image</label><input className="input" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} /></div>
        <div className="flex justify-end"><button className="btn-primary" disabled={saving}>{saving ? "Saving..." : "Save Destination"}</button></div>
      </form>
    </Modal>
  );
}
