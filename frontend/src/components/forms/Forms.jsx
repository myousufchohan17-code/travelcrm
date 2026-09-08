import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "../../api/client";

const emptyClient = {
  full_name: "",
  phone: "",
  email: "",
  address: "",
  country: "",
  preferred_destination_id: "",
  notes: "",
};

export function ClientForm({ initial, onSubmit, submitting }) {
  const [form, setForm] = useState(emptyClient);
  const destinations = useQuery({
    queryKey: ["destinations"],
    queryFn: async () => (await api.get("/destinations")).data,
  });

  useEffect(() => {
    if (initial) {
      setForm({
        ...emptyClient,
        ...initial,
        preferred_destination_id: initial.preferred_destination_id || "",
      });
    }
  }, [initial]);

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          ...form,
          preferred_destination_id: form.preferred_destination_id || null,
        });
      }}
    >
      <div className="sm:col-span-2">
        <label className="label">Full Name *</label>
        <input className="input" required value={form.full_name} onChange={(e) => set("full_name", e.target.value)} />
      </div>
      <div>
        <label className="label">Phone Number *</label>
        <input className="input" required value={form.phone} onChange={(e) => set("phone", e.target.value)} />
      </div>
      <div>
        <label className="label">Email</label>
        <input className="input" type="email" value={form.email || ""} onChange={(e) => set("email", e.target.value)} />
      </div>
      <div>
        <label className="label">Country</label>
        <input className="input" value={form.country || ""} onChange={(e) => set("country", e.target.value)} />
      </div>
      <div>
        <label className="label">Preferred Destination</label>
        <select className="input" value={form.preferred_destination_id} onChange={(e) => set("preferred_destination_id", e.target.value)}>
          <option value="">Select destination</option>
          {(destinations.data || []).map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="label">Address</label>
        <input className="input" value={form.address || ""} onChange={(e) => set("address", e.target.value)} />
      </div>
      <div className="sm:col-span-2">
        <label className="label">Notes</label>
        <textarea className="input min-h-[90px]" value={form.notes || ""} onChange={(e) => set("notes", e.target.value)} />
      </div>
      <div className="sm:col-span-2 flex justify-stretch pt-2 sm:justify-end">
        <button className="btn-primary w-full sm:w-auto" disabled={submitting}>{submitting ? "Saving..." : "Save Client"}</button>
      </div>
    </form>
  );
}

const emptyBooking = {
  client_id: "",
  package_id: "",
  destination_id: "",
  departure_date: "",
  return_date: "",
  travelers: 1,
  total_amount: "",
  payment_status: "unpaid",
  status: "pending",
  assigned_agent_id: "",
  notes: "",
};

export function BookingForm({ initial, onSubmit, submitting }) {
  const [form, setForm] = useState(emptyBooking);
  const clients = useQuery({ queryKey: ["clients-all"], queryFn: async () => (await api.get("/clients", { params: { limit: 50 } })).data.data });
  const packages = useQuery({ queryKey: ["packages-all"], queryFn: async () => (await api.get("/packages", { params: { limit: 50 } })).data.data });
  const destinations = useQuery({ queryKey: ["destinations"], queryFn: async () => (await api.get("/destinations")).data });
  const agents = useQuery({ queryKey: ["agents"], queryFn: async () => (await api.get("/agents")).data });

  useEffect(() => {
    if (initial) {
      setForm({
        ...emptyBooking,
        ...initial,
        client_id: initial.client_id || "",
        package_id: initial.package_id || "",
        destination_id: initial.destination_id || "",
        assigned_agent_id: initial.assigned_agent_id || "",
        travelers: initial.travelers || 1,
        total_amount: initial.total_amount ?? "",
      });
    }
  }, [initial]);

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function onPackage(id) {
    const pkg = (packages.data || []).find((p) => String(p.id) === String(id));
    setForm((f) => ({
      ...f,
      package_id: id,
      destination_id: pkg?.destination_id || f.destination_id,
      total_amount: pkg?.price ?? f.total_amount,
    }));
  }

  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          ...form,
          client_id: Number(form.client_id),
          package_id: form.package_id || null,
          destination_id: form.destination_id || null,
          assigned_agent_id: form.assigned_agent_id || null,
          travelers: Number(form.travelers) || 1,
          total_amount: Number(form.total_amount) || 0,
        });
      }}
    >
      <div>
        <label className="label">Client *</label>
        <select className="input" required value={form.client_id} onChange={(e) => set("client_id", e.target.value)}>
          <option value="">Select client</option>
          {(clients.data || []).map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
        </select>
        {!clients.data?.length && <p className="mt-1 text-xs text-slate-400">Add a client first if this list is empty.</p>}
      </div>
      <div>
        <label className="label">Travel Package</label>
        <select className="input" value={form.package_id} onChange={(e) => onPackage(e.target.value)}>
          <option value="">Select package</option>
          {(packages.data || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Destination</label>
        <select className="input" value={form.destination_id} onChange={(e) => set("destination_id", e.target.value)}>
          <option value="">Select destination</option>
          {(destinations.data || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Assigned Agent</label>
        <select className="input" value={form.assigned_agent_id} onChange={(e) => set("assigned_agent_id", e.target.value)}>
          <option value="">Unassigned</option>
          {(agents.data || []).map((a) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Departure Date *</label>
        <input className="input" type="date" required value={form.departure_date || ""} onChange={(e) => set("departure_date", e.target.value)} />
      </div>
      <div>
        <label className="label">Return Date</label>
        <input className="input" type="date" value={form.return_date || ""} onChange={(e) => set("return_date", e.target.value)} />
      </div>
      <div>
        <label className="label">Number of Travelers</label>
        <input className="input" type="number" min="1" value={form.travelers} onChange={(e) => set("travelers", e.target.value)} />
      </div>
      <div>
        <label className="label">Total Amount</label>
        <input className="input" type="number" min="0" step="0.01" value={form.total_amount} onChange={(e) => set("total_amount", e.target.value)} />
      </div>
      <div>
        <label className="label">Payment Status</label>
        <select className="input" value={form.payment_status} onChange={(e) => set("payment_status", e.target.value)}>
          <option value="unpaid">Unpaid</option>
          <option value="partial">Partial</option>
          <option value="paid">Paid</option>
          <option value="refunded">Refunded</option>
        </select>
      </div>
      <div>
        <label className="label">Booking Status</label>
        <select className="input" value={form.status} onChange={(e) => set("status", e.target.value)}>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="processing">Processing</option>
          <option value="cancelled">Cancelled</option>
          <option value="completed">Completed</option>
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="label">Notes</label>
        <textarea className="input min-h-[80px]" value={form.notes || ""} onChange={(e) => set("notes", e.target.value)} />
      </div>
      <div className="sm:col-span-2 flex justify-stretch pt-2 sm:justify-end">
        <button className="btn-primary w-full sm:w-auto" disabled={submitting}>{submitting ? "Saving..." : "Save Booking"}</button>
      </div>
    </form>
  );
}

const emptyPackage = {
  name: "",
  category: "International",
  destination_id: "",
  duration: "",
  price: "",
  description: "",
  included_services: "",
  excluded_services: "",
  status: "active",
};

export function PackageForm({ initial, onSubmit, submitting }) {
  const [form, setForm] = useState(emptyPackage);
  const [file, setFile] = useState(null);
  const destinations = useQuery({ queryKey: ["destinations"], queryFn: async () => (await api.get("/destinations")).data });

  useEffect(() => {
    if (initial) {
      setForm({
        ...emptyPackage,
        ...initial,
        destination_id: initial.destination_id || "",
        price: initial.price ?? "",
      });
    }
  }, [initial]);

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData();
        Object.entries(form).forEach(([k, v]) => fd.append(k, v ?? ""));
        if (file) fd.append("image", file);
        onSubmit(fd);
      }}
    >
      <div className="sm:col-span-2">
        <label className="label">Package Name *</label>
        <input className="input" required value={form.name} onChange={(e) => set("name", e.target.value)} />
      </div>
      <div>
        <label className="label">Category</label>
        <select className="input" value={form.category} onChange={(e) => set("category", e.target.value)}>
          {["International", "Domestic", "Honeymoon", "Group Tours", "Other"].map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Destination</label>
        <select className="input" value={form.destination_id} onChange={(e) => set("destination_id", e.target.value)}>
          <option value="">Select destination</option>
          {(destinations.data || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Duration</label>
        <input className="input" placeholder="e.g. 7 Days / 6 Nights" value={form.duration || ""} onChange={(e) => set("duration", e.target.value)} />
      </div>
      <div>
        <label className="label">Price</label>
        <input className="input" type="number" min="0" step="0.01" value={form.price} onChange={(e) => set("price", e.target.value)} />
      </div>
      <div>
        <label className="label">Status</label>
        <select className="input" value={form.status} onChange={(e) => set("status", e.target.value)}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
      <div>
        <label className="label">Package Image</label>
        <input className="input" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      </div>
      <div className="sm:col-span-2">
        <label className="label">Description</label>
        <textarea className="input min-h-[80px]" value={form.description || ""} onChange={(e) => set("description", e.target.value)} />
      </div>
      <div>
        <label className="label">Included Services</label>
        <textarea className="input min-h-[80px]" value={form.included_services || ""} onChange={(e) => set("included_services", e.target.value)} />
      </div>
      <div>
        <label className="label">Excluded Services</label>
        <textarea className="input min-h-[80px]" value={form.excluded_services || ""} onChange={(e) => set("excluded_services", e.target.value)} />
      </div>
      <div className="sm:col-span-2 flex justify-stretch pt-2 sm:justify-end">
        <button className="btn-primary w-full sm:w-auto" disabled={submitting}>{submitting ? "Saving..." : "Save Package"}</button>
      </div>
    </form>
  );
}

const emptyLead = {
  name: "",
  phone: "",
  email: "",
  source: "",
  interested_destination_id: "",
  budget: "",
  travel_date: "",
  travelers: 1,
  status: "new",
  assigned_agent_id: "",
  notes: "",
};

export function LeadForm({ initial, onSubmit, submitting }) {
  const [form, setForm] = useState(emptyLead);
  const destinations = useQuery({ queryKey: ["destinations"], queryFn: async () => (await api.get("/destinations")).data });
  const agents = useQuery({ queryKey: ["agents"], queryFn: async () => (await api.get("/agents")).data });

  useEffect(() => {
    if (initial) {
      setForm({
        ...emptyLead,
        ...initial,
        interested_destination_id: initial.interested_destination_id || "",
        assigned_agent_id: initial.assigned_agent_id || "",
        budget: initial.budget ?? "",
      });
    }
  }, [initial]);

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          ...form,
          interested_destination_id: form.interested_destination_id || null,
          assigned_agent_id: form.assigned_agent_id || null,
          budget: form.budget || null,
          travelers: Number(form.travelers) || 1,
        });
      }}
    >
      <div>
        <label className="label">Name *</label>
        <input className="input" required value={form.name} onChange={(e) => set("name", e.target.value)} />
      </div>
      <div>
        <label className="label">Phone *</label>
        <input className="input" required value={form.phone} onChange={(e) => set("phone", e.target.value)} />
      </div>
      <div>
        <label className="label">Email</label>
        <input className="input" type="email" value={form.email || ""} onChange={(e) => set("email", e.target.value)} />
      </div>
      <div>
        <label className="label">Source</label>
        <input className="input" placeholder="Website, referral, walk-in..." value={form.source || ""} onChange={(e) => set("source", e.target.value)} />
      </div>
      <div>
        <label className="label">Interested Destination</label>
        <select className="input" value={form.interested_destination_id} onChange={(e) => set("interested_destination_id", e.target.value)}>
          <option value="">Select destination</option>
          {(destinations.data || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Assigned Agent</label>
        <select className="input" value={form.assigned_agent_id} onChange={(e) => set("assigned_agent_id", e.target.value)}>
          <option value="">Unassigned</option>
          {(agents.data || []).map((a) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Budget</label>
        <input className="input" type="number" min="0" value={form.budget} onChange={(e) => set("budget", e.target.value)} />
      </div>
      <div>
        <label className="label">Travel Date</label>
        <input className="input" type="date" value={form.travel_date || ""} onChange={(e) => set("travel_date", e.target.value)} />
      </div>
      <div>
        <label className="label">Travelers</label>
        <input className="input" type="number" min="1" value={form.travelers} onChange={(e) => set("travelers", e.target.value)} />
      </div>
      <div>
        <label className="label">Status</label>
        <select className="input" value={form.status} onChange={(e) => set("status", e.target.value)}>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="qualified">Qualified</option>
          <option value="converted">Converted</option>
          <option value="lost">Lost</option>
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="label">Notes</label>
        <textarea className="input min-h-[80px]" value={form.notes || ""} onChange={(e) => set("notes", e.target.value)} />
      </div>
      <div className="sm:col-span-2 flex justify-stretch pt-2 sm:justify-end">
        <button className="btn-primary w-full sm:w-auto" disabled={submitting}>{submitting ? "Saving..." : "Save Lead"}</button>
      </div>
    </form>
  );
}

const emptyFollow = {
  client_id: "",
  lead_id: "",
  follow_up_date: "",
  follow_up_time: "",
  type: "call",
  notes: "",
  assigned_agent_id: "",
  status: "scheduled",
};

export function FollowUpForm({ initial, onSubmit, submitting }) {
  const [form, setForm] = useState(emptyFollow);
  const clients = useQuery({ queryKey: ["clients-all"], queryFn: async () => (await api.get("/clients", { params: { limit: 50 } })).data.data });
  const leads = useQuery({ queryKey: ["leads-all"], queryFn: async () => (await api.get("/leads", { params: { limit: 50 } })).data.data });
  const agents = useQuery({ queryKey: ["agents"], queryFn: async () => (await api.get("/agents")).data });

  useEffect(() => {
    if (initial) {
      setForm({
        ...emptyFollow,
        ...initial,
        client_id: initial.client_id || "",
        lead_id: initial.lead_id || "",
        assigned_agent_id: initial.assigned_agent_id || "",
        follow_up_time: initial.follow_up_time ? String(initial.follow_up_time).slice(0, 5) : "",
      });
    }
  }, [initial]);

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          ...form,
          client_id: form.client_id || null,
          lead_id: form.lead_id || null,
          assigned_agent_id: form.assigned_agent_id || null,
        });
      }}
    >
      <div>
        <label className="label">Client</label>
        <select className="input" value={form.client_id} onChange={(e) => set("client_id", e.target.value)}>
          <option value="">None</option>
          {(clients.data || []).map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Lead</label>
        <select className="input" value={form.lead_id} onChange={(e) => set("lead_id", e.target.value)}>
          <option value="">None</option>
          {(leads.data || []).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Date *</label>
        <input className="input" type="date" required value={form.follow_up_date || ""} onChange={(e) => set("follow_up_date", e.target.value)} />
      </div>
      <div>
        <label className="label">Time</label>
        <input className="input" type="time" value={form.follow_up_time || ""} onChange={(e) => set("follow_up_time", e.target.value)} />
      </div>
      <div>
        <label className="label">Follow-up Type</label>
        <select className="input" value={form.type} onChange={(e) => set("type", e.target.value)}>
          <option value="call">Call</option>
          <option value="email">Email</option>
          <option value="meeting">Meeting</option>
          <option value="whatsapp">WhatsApp</option>
        </select>
      </div>
      <div>
        <label className="label">Assigned Agent</label>
        <select className="input" value={form.assigned_agent_id} onChange={(e) => set("assigned_agent_id", e.target.value)}>
          <option value="">Unassigned</option>
          {(agents.data || []).map((a) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Status</label>
        <select className="input" value={form.status} onChange={(e) => set("status", e.target.value)}>
          <option value="scheduled">Scheduled</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="rescheduled">Rescheduled</option>
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="label">Notes</label>
        <textarea className="input min-h-[80px]" value={form.notes || ""} onChange={(e) => set("notes", e.target.value)} />
      </div>
      <div className="sm:col-span-2 flex justify-stretch pt-2 sm:justify-end">
        <button className="btn-primary w-full sm:w-auto" disabled={submitting}>{submitting ? "Saving..." : "Save Follow-up"}</button>
      </div>
    </form>
  );
}
