import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import api, { money } from "../../api/client";

function dateString(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function initialInvoice(invoice, bookingId, clientId) {
  if (invoice) {
    return {
      ...invoice,
      client_id: invoice.client_id || "",
      booking_id: invoice.booking_id || "",
      issue_date: String(invoice.issue_date || "").slice(0, 10),
      due_date: String(invoice.due_date || "").slice(0, 10),
      travel_start_date: String(invoice.travel_start_date || "").slice(0, 10),
      travel_end_date: String(invoice.travel_end_date || "").slice(0, 10),
      payment_date: String(invoice.payment_date || "").slice(0, 10),
      amount_paid: invoice.amount_paid || 0,
      items: (invoice.items || []).map((item) => ({
        description: item.description || "",
        quantity: item.quantity || 1,
        unit_price: item.unitPrice ?? item.unit_price ?? 0,
      })),
      status: invoice.status || "pending",
    };
  }
  const today = new Date();
  const due = new Date(today);
  due.setDate(due.getDate() + 14);
  return {
    client_id: clientId || "",
    booking_id: bookingId || "",
    issue_date: dateString(today),
    due_date: dateString(due),
    destination: "",
    travel_start_date: "",
    travel_end_date: "",
    items: [],
    discount: 0,
    tax: 0,
    amount_paid: 0,
    status: "pending",
    payment_method: "",
    payment_date: "",
    notes: "",
  };
}

export function InvoiceForm({ initial, onSubmit, submitting }) {
  const invoice = initial?.invoice || (initial?.invoice_number ? initial : null);
  const [form, setForm] = useState(() => initialInvoice(invoice, initial?.bookingId, initial?.client_id));
  const [bookingPrefilled, setBookingPrefilled] = useState(false);
  const clients = useQuery({
    queryKey: ["clients-all"],
    queryFn: async () => (await api.get("/clients", { params: { limit: 50 } })).data.data,
  });
  const bookings = useQuery({
    queryKey: ["bookings-all-for-invoice"],
    queryFn: async () => (await api.get("/bookings", { params: { page: 1, limit: 50 } })).data.data,
  });
  const selectedBooking = (bookings.data || []).find((booking) => String(booking.id) === String(form.booking_id));
  const bookingDetail = useQuery({
    queryKey: ["booking", form.booking_id],
    enabled: Boolean(form.booking_id) && !selectedBooking,
    queryFn: async () => (await api.get(`/bookings/${form.booking_id}`)).data,
  });
  const booking = selectedBooking || bookingDetail.data;
  const subtotal = Math.round(form.items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0), 0) * 100) / 100;
  const discount = Number(form.discount) || 0;
  const tax = Number(form.tax) || 0;
  const total = Math.max(0, Math.round((subtotal - discount + tax) * 100) / 100);

  useEffect(() => {
    if (invoice || !booking || bookingPrefilled) return;
    const packageName = booking.package_name || booking.destination_name || "Travel services";
    setForm((current) => ({
      ...current,
      client_id: current.client_id || booking.client_id || "",
      destination: current.destination || booking.destination_name || booking.package_name || "",
      travel_start_date: current.travel_start_date || String(booking.departure_date || "").slice(0, 10),
      travel_end_date: current.travel_end_date || String(booking.return_date || "").slice(0, 10),
      items: current.items.length ? current.items : [{
        description: packageName,
        quantity: 1,
        unit_price: Number(booking.total_amount) || 0,
      }],
    }));
    setBookingPrefilled(true);
  }, [form.booking_id, booking, invoice, bookingPrefilled]);

  function set(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function setItem(index, key, value) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item),
    }));
  }

  function selectBooking(id) {
    const chosen = (bookings.data || []).find((item) => String(item.id) === String(id));
    setForm((current) => ({
      ...current,
      booking_id: id,
      client_id: chosen?.client_id || current.client_id,
      destination: chosen?.destination_name || chosen?.package_name || "",
      travel_start_date: String(chosen?.departure_date || "").slice(0, 10),
      travel_end_date: String(chosen?.return_date || "").slice(0, 10),
      items: chosen ? [{
        description: chosen.package_name || chosen.destination_name || "Travel services",
        quantity: 1,
        unit_price: Number(chosen.total_amount) || 0,
      }] : current.items,
    }));
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({
          ...form,
          client_id: Number(form.client_id),
          booking_id: form.booking_id || null,
          discount: Number(form.discount) || 0,
          tax: Number(form.tax) || 0,
          amount_paid: Number(form.amount_paid) || 0,
          items: form.items.map((item) => ({ ...item, quantity: Number(item.quantity), unit_price: Number(item.unit_price) })),
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Client *</label>
          <select className="input" required value={form.client_id} onChange={(event) => set("client_id", event.target.value)}>
            <option value="">Select client</option>
            {(clients.data || []).map((client) => <option key={client.id} value={client.id}>{client.full_name}</option>)}
          </select>
          {clients.isError ? <p className="mt-1 text-xs text-red-500">Could not load clients. Refresh and try again.</p> : null}
        </div>
        <div>
          <label className="label">Booking / Trip</label>
          <select className="input" value={form.booking_id} onChange={(event) => selectBooking(event.target.value)}>
            <option value="">No booking linked</option>
            {(bookings.data || []).filter((item) => !form.client_id || String(item.client_id) === String(form.client_id)).map((item) => (
              <option key={item.id} value={item.id}>#{item.id} · {item.client_name} · {item.destination_name || item.package_name || "Trip"}</option>
            ))}
          </select>
          {bookings.isError ? <p className="mt-1 text-xs text-red-500">Could not load bookings.</p> : null}
        </div>
        <div>
          <label className="label">Invoice Date *</label>
          <input className="input" type="date" required value={form.issue_date} onChange={(event) => set("issue_date", event.target.value)} />
        </div>
        <div>
          <label className="label">Due Date *</label>
          <input className="input" type="date" required min={form.issue_date} value={form.due_date} onChange={(event) => set("due_date", event.target.value)} />
        </div>
        <div>
          <label className="label">Destination</label>
          <input className="input" value={form.destination || ""} onChange={(event) => set("destination", event.target.value)} />
        </div>
        <div>
          <label className="label">Travel Start</label>
          <input className="input" type="date" value={form.travel_start_date || ""} onChange={(event) => set("travel_start_date", event.target.value)} />
        </div>
        <div>
          <label className="label">Travel End</label>
          <input className="input" type="date" min={form.travel_start_date || undefined} value={form.travel_end_date || ""} onChange={(event) => set("travel_end_date", event.target.value)} />
        </div>
        <div>
          <label className="label">Payment Status</label>
          <select className="input" value={form.status} onChange={(event) => {
            const nextStatus = event.target.value;
            setForm((current) => ({
              ...current,
              status: nextStatus,
              amount_paid: nextStatus === "paid" ? total : current.status === "paid" ? 0 : current.amount_paid,
              payment_date: nextStatus === "paid" ? current.payment_date || current.issue_date : current.payment_date,
            }));
          }}>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      <section className="space-y-3 border-t border-slate-100 pt-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-bold text-slate-800">Services & items</h4>
            <p className="text-xs text-slate-400">Line totals update as you edit.</p>
          </div>
          <button type="button" className="btn-secondary !px-3 !py-2 !text-xs" onClick={() => set("items", [...form.items, { description: "", quantity: 1, unit_price: 0 }])}>
            <Plus className="h-4 w-4" /> Add item
          </button>
        </div>
        {!form.items.length ? <p className="rounded-xl bg-slate-50 px-4 py-5 text-center text-sm text-slate-400">Add the first service to this invoice.</p> : null}
        {form.items.map((item, index) => (
          <div key={index} className="grid gap-2 rounded-xl border border-slate-100 p-3 sm:grid-cols-[minmax(0,1fr)_90px_130px_110px_36px] sm:items-end sm:p-2">
            <div>
              <label className="label">Description *</label>
              <input className="input" required value={item.description} onChange={(event) => setItem(index, "description", event.target.value)} />
            </div>
            <div>
              <label className="label">Qty</label>
              <input className="input" type="number" min="0.01" step="0.01" required value={item.quantity} onChange={(event) => setItem(index, "quantity", event.target.value)} />
            </div>
            <div>
              <label className="label">Unit Price</label>
              <input className="input" type="number" min="0" step="0.01" required value={item.unit_price} onChange={(event) => setItem(index, "unit_price", event.target.value)} />
            </div>
            <div className="sm:text-right">
              <label className="label">Line Total</label>
              <p className="flex h-10 items-center text-sm font-semibold text-slate-700 sm:justify-end">{money((Number(item.quantity) || 0) * (Number(item.unit_price) || 0))}</p>
            </div>
            <button type="button" className="flex h-10 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Remove item ${index + 1}`} onClick={() => set("items", form.items.filter((_, itemIndex) => itemIndex !== index))}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Payment Method</label>
          <select className="input" value={form.payment_method || ""} onChange={(event) => set("payment_method", event.target.value)}>
            <option value="">Not recorded</option>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="bank transfer">Bank transfer</option>
            <option value="mobile wallet">Mobile wallet</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="label">Payment Date</label>
          <input className="input" type="date" value={form.payment_date || ""} onChange={(event) => set("payment_date", event.target.value)} />
        </div>
        <div>
          <label className="label">Discount</label>
          <input className="input" type="number" min="0" max={subtotal} step="0.01" value={form.discount} onChange={(event) => set("discount", event.target.value)} />
        </div>
        <div>
          <label className="label">Tax</label>
          <input className="input" type="number" min="0" step="0.01" value={form.tax} onChange={(event) => set("tax", event.target.value)} />
        </div>
        <div>
          <label className="label">Paid Amount</label>
          <input className="input" type="number" min="0" max={total} step="0.01" value={form.amount_paid} onChange={(event) => set("amount_paid", event.target.value)} />
        </div>
        <div className="flex items-center justify-between rounded-xl bg-brand-50 px-4 py-3 sm:col-span-2">
          <div>
            <p className="text-xs font-medium text-slate-500">Subtotal {discount ? `− ${money(discount)} discount` : ""} {tax ? `+ ${money(tax)} tax` : ""}</p>
            <p className="mt-1 text-xs text-slate-500">Remaining balance</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-extrabold text-brand-700">{money(total)}</p>
            <p className="text-xs font-semibold text-slate-600">{money(Math.max(0, total - (Number(form.amount_paid) || 0)))}</p>
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Notes / Terms</label>
          <textarea className="input min-h-[80px]" value={form.notes || ""} onChange={(event) => set("notes", event.target.value)} />
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
        <button className="btn-primary w-full sm:w-auto" disabled={submitting || clients.isLoading || !form.items.length}>
          {submitting ? "Saving..." : invoice ? "Save Changes" : "Create Invoice"}
        </button>
      </div>
    </form>
  );
}

export function InvoicePaymentForm({ invoice, onSubmit, submitting }) {
  const [form, setForm] = useState({ amount: "", payment_date: dateString(new Date()), payment_method: invoice?.payment_method || "", reference: "" });
  const remaining = Math.max(0, Number(invoice?.total || 0) - Number(invoice?.amount_paid || 0));
  return (
    <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); onSubmit({ ...form, amount: Number(form.amount) }); }}>
      <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">Remaining balance: <strong>{money(remaining)}</strong></p>
      <div>
        <label className="label">Payment Amount *</label>
        <input className="input" required type="number" min="0.01" max={remaining} step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Payment Date *</label>
          <input className="input" required type="date" value={form.payment_date} onChange={(event) => setForm({ ...form, payment_date: event.target.value })} />
        </div>
        <div>
          <label className="label">Payment Method</label>
          <select className="input" value={form.payment_method} onChange={(event) => setForm({ ...form, payment_method: event.target.value })}>
            <option value="">Not recorded</option>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="bank transfer">Bank transfer</option>
            <option value="mobile wallet">Mobile wallet</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>
      <div>
        <label className="label">Reference</label>
        <input className="input" value={form.reference} onChange={(event) => setForm({ ...form, reference: event.target.value })} />
      </div>
      <div className="flex justify-end pt-2">
        <button className="btn-primary w-full sm:w-auto" disabled={submitting || remaining <= 0}>{submitting ? "Recording..." : "Record Payment"}</button>
      </div>
    </form>
  );
}