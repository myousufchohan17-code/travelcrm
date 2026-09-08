import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import api, { errorMessage } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useUi } from "../context/UiContext";
import { EmptyState, Loader, Modal, StatusBadge } from "../components/ui/Common";

export default function Settings() {
  const { user, setUser, settings, setSettings, refresh } = useAuth();
  const { toast, askConfirm, invalidateAll } = useUi();
  const [profile, setProfile] = useState({ full_name: user?.full_name || "", phone: user?.phone || "", email: user?.email || "" });
  const [company, setCompany] = useState(settings?.company_name || "");
  const [agentModal, setAgentModal] = useState(null);
  const [destModal, setDestModal] = useState(null);

  const agents = useQuery({ queryKey: ["agents"], queryFn: async () => (await api.get("/agents")).data });
  const destinations = useQuery({ queryKey: ["destinations"], queryFn: async () => (await api.get("/destinations")).data });
  const activities = useQuery({ queryKey: ["activities"], queryFn: async () => (await api.get("/activities")).data });

  async function saveProfile(e) {
    e.preventDefault();
    const fd = new FormData();
    fd.append("full_name", profile.full_name);
    fd.append("phone", profile.phone || "");
    fd.append("email", profile.email || "");
    const file = e.target.avatar?.files?.[0];
    if (file) fd.append("avatar", file);
    try {
      const { data } = await api.patch("/profile", fd);
      setUser(data);
      toast("Profile updated");
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  }

  async function saveCompany(e) {
    e.preventDefault();
    try {
      const { data } = await api.put("/settings", { company_name: company });
      setSettings(data);
      toast("Company settings saved");
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  }

  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <div className="space-y-5">
        <form className="card p-5" onSubmit={saveProfile}>
          <h2 className="mb-4 font-extrabold">Profile</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label">Full name</label>
              <input className="input" value={profile.full_name} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" value={profile.email || ""} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" value={profile.phone || ""} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Avatar</label>
              <input className="input" type="file" name="avatar" accept="image/*" />
            </div>
          </div>
          <button className="btn-primary mt-4">Save profile</button>
        </form>

        <form className="card p-5" onSubmit={saveCompany}>
          <h2 className="mb-4 font-extrabold">Company</h2>
          <label className="label">Company name</label>
          <input className="input" value={company} onChange={(e) => setCompany(e.target.value)} />
          <button className="btn-primary mt-4">Save company</button>
        </form>

        <div className="card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-extrabold">Destinations</h2>
            <button className="btn-primary !py-1.5 !text-xs" onClick={() => setDestModal({})}><Plus className="h-3.5 w-3.5" /> Add</button>
          </div>
          {destinations.isPending && !destinations.data ? <Loader /> : !destinations.data?.length ? (
            <EmptyState title="No destinations available" hint="Add destinations before creating packages and bookings." />
          ) : (
            <div className="space-y-2">
              {destinations.data.map((d) => (
                <div key={d.id} className="flex min-w-0 items-center gap-3 rounded-xl bg-slate-50 p-2">
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-slate-200">
                    {d.image ? <img src={d.image} alt="" className="h-full w-full object-cover" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{d.name}</p>
                    <p className="truncate text-xs text-slate-400">{d.country || "Country not set"}</p>
                  </div>
                  <button className="rounded-lg p-1.5 text-slate-400 hover:bg-white" onClick={() => setDestModal(d)}><Pencil className="h-4 w-4" /></button>
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
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-5">
        <div className="card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-extrabold">Agents</h2>
            <button className="btn-primary !py-1.5 !text-xs" onClick={() => setAgentModal({ full_name: "", email: "", phone: "", status: "active" })}>
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          </div>
          {agents.isPending && !agents.data ? <Loader /> : !agents.data?.length ? (
            <EmptyState title="No agents yet" hint="Your admin account is already linked as an agent after setup." />
          ) : (
            <div className="space-y-2">
              {agents.data.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-brand-50 text-center text-xs font-bold leading-10 text-brand-700">
                      {a.image ? <img src={a.image} alt="" className="h-full w-full object-cover" /> : (a.full_name || "?").slice(0, 1)}
                    </div>
                    <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{a.full_name}</p>
                    <p className="truncate text-xs text-slate-400">{a.email || a.phone || "No contact"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge value={a.status} />
                    <button className="rounded-lg p-1.5 text-slate-400 hover:bg-white" onClick={() => setAgentModal(a)}><Pencil className="h-4 w-4" /></button>
                    <button
                      className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                      onClick={() =>
                        askConfirm({
                          title: "Delete agent",
                          message: `${a.full_name} will be deleted. Assigned bookings, leads and follow-ups will become unassigned.`,
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
              ))}
            </div>
          )}
        </div>

        <div className="card p-5">
          <h2 className="mb-4 font-extrabold">Recent Activity</h2>
          {activities.isPending && !activities.data ? <Loader /> : !activities.data?.length ? (
            <EmptyState title="No recent activity" hint="Actions such as adding a client or booking appear here." />
          ) : (
            <div className="space-y-3">
              {activities.data.map((a) => (
                <div key={a.id} className="border-l-2 border-brand-200 pl-3">
                  <p className="text-sm font-medium text-slate-700">{a.description}</p>
                  <p className="text-[11px] text-slate-400">{a.user_name || "System"} · {new Date(a.created_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {agentModal && (
        <AgentModal
          initial={agentModal}
          onClose={() => setAgentModal(null)}
          onSaved={() => {
            setAgentModal(null);
            invalidateAll();
            refresh();
          }}
        />
      )}
      {destModal && (
        <DestinationModal
          initial={destModal}
          onClose={() => setDestModal(null)}
          onSaved={() => {
            setDestModal(null);
            invalidateAll();
          }}
        />
      )}
    </div>
  );
}

function AgentModal({ initial, onClose, onSaved }) {
  const { toast } = useUi();
  const [form, setForm] = useState(initial);
  const save = useMutation({
    mutationFn: () => (initial.id ? api.put(`/agents/${initial.id}`, form) : api.post("/agents", form)),
    onSuccess: () => {
      toast("Agent saved");
      onSaved();
    },
    onError: (err) => toast(errorMessage(err), "error"),
  });
  return (
    <Modal title={initial.id ? "Edit agent" : "Add agent"} onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <div><label className="label">Name *</label><input className="input" required value={form.full_name || ""} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
        <div><label className="label">Email</label><input className="input" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div><label className="label">Phone</label><input className="input" value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        <div>
          <label className="label">Status</label>
          <select className="input" value={form.status || "active"} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div className="flex justify-end"><button className="btn-primary" disabled={save.isPending}>Save</button></div>
      </form>
    </Modal>
  );
}

function DestinationModal({ initial, onClose, onSaved }) {
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
      toast("Destination saved");
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
        <div><label className="label">Name *</label><input className="input" required value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><label className="label">Country</label><input className="input" value={country} onChange={(e) => setCountry(e.target.value)} /></div>
        <div><label className="label">Image</label><input className="input" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} /></div>
        <div className="flex justify-end"><button className="btn-primary" disabled={saving}>{saving ? "Saving..." : "Save"}</button></div>
      </form>
    </Modal>
  );
}
