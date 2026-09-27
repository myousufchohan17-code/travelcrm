import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import api, { errorMessage, formatDate, money } from "../../api/client";
import { useUi } from "../../context/UiContext";
import { ConfirmModal, Modal, StatusBadge } from "../ui/Common";
import { BookingForm, ClientForm, FollowUpForm, InventoryForm, LeadForm, PackageForm } from "../forms/Forms";
import { InvoiceForm, InvoicePaymentForm } from "../forms/InvoiceForm";

const saveQueryKeys = {
  client: [["clients"], ["client"], ["recent-clients"], ["dashboard-stats"], ["reports"]],
  booking: [["bookings"], ["booking"], ["dashboard-stats"], ["bookings-overview"], ["upcoming-bookings"], ["reports"], ["inventory"], ["inventory-summary"]],
  package: [["packages"], ["package-categories"], ["bookings"], ["booking"], ["reports"]],
  inventory: [["inventory"], ["inventory-summary"], ["bookings"], ["booking"]],
  lead: [["leads"], ["dashboard-stats"], ["reports"]],
  followup: [["follow-ups"]],
  invoice: [["invoices"], ["invoice"], ["invoices-summary"], ["bookings"], ["booking"], ["clients"], ["client"]],
  "invoice-payment": [["invoices"], ["invoice"], ["invoices-summary"], ["bookings"], ["booking"]],
  message: [["conversations"], ["thread"], ["messages-unread"]],
};

export default function GlobalModals() {
  const navigate = useNavigate();
  const { modal, openModal, closeModal, toast, invalidateAll, confirm, setConfirm } = useUi();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const save = async (fn) => {
    setSaving(true);
    try {
      await fn();
      invalidateAll(saveQueryKeys[modal?.type] || []);
      toast("Saved successfully");
      closeModal();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  async function onConfirmDelete() {
    if (!confirm?.onConfirm) return;
    setDeleting(true);
    try {
      await confirm.onConfirm();
      invalidateAll(confirm.queryKeys);
      toast("Deleted successfully");
      setConfirm(null);
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      {modal?.type === "client" && (
        <Modal title={modal.payload ? "Edit Client" : "Add Client"} onClose={closeModal}>
          <ClientForm
            initial={modal.payload}
            submitting={saving}
            onSubmit={(body) =>
              save(() => (modal.payload ? api.put(`/clients/${modal.payload.id}`, body) : api.post("/clients", body)))
            }
          />
        </Modal>
      )}
      {modal?.type === "booking" && (
        <Modal title={modal.payload ? "Edit Booking" : "New Booking"} onClose={closeModal} wide>
          <BookingForm
            initial={modal.payload}
            submitting={saving}
            onSubmit={(body) =>
              save(() => (modal.payload ? api.put(`/bookings/${modal.payload.id}`, body) : api.post("/bookings", body)))
            }
          />
        </Modal>
      )}
      {modal?.type === "invoice" && (
        <Modal title={modal.payload?.invoice || modal.payload?.invoice_number ? "Edit Invoice" : "Create Invoice"} onClose={closeModal} wide>
          <InvoiceForm
            initial={modal.payload}
            submitting={saving}
            onSubmit={(body) => save(() => {
              const invoice = modal.payload?.invoice || (modal.payload?.invoice_number ? modal.payload : null);
              return invoice ? api.put(`/invoices/${invoice.id}`, body) : api.post("/invoices", body);
            })}
          />
        </Modal>
      )}
      {modal?.type === "invoice-payment" && (
        <Modal title={`Record payment · ${modal.payload?.invoice_number || "Invoice"}`} onClose={closeModal}>
          <InvoicePaymentForm
            invoice={modal.payload}
            submitting={saving}
            onSubmit={(body) => save(() => api.patch(`/invoices/${modal.payload.id}/payment`, { ...body, action: "record" }))}
          />
        </Modal>
      )}
      {modal?.type === "package" && (
        <Modal title={modal.payload ? "Edit Package" : "Create Package"} onClose={closeModal} wide>
          <PackageForm
            initial={modal.payload}
            submitting={saving}
            onSubmit={(fd) =>
              save(() =>
                modal.payload
                  ? api.put(`/packages/${modal.payload.id}`, fd)
                  : api.post("/packages", fd)
              )
            }
          />
        </Modal>
      )}
      {modal?.type === "inventory" && (
        <Modal title={modal.payload ? "Edit Inventory" : "Add Inventory"} onClose={closeModal} wide>
          <InventoryForm initial={modal.payload} submitting={saving} onSubmit={(body) => save(() => modal.payload ? api.put(`/inventory/${modal.payload.id}`, body) : api.post("/inventory", body))} />
        </Modal>
      )}
      {modal?.type === "lead" && (
        <Modal title={modal.payload ? "Edit Lead" : "Add Lead"} onClose={closeModal}>
          <LeadForm
            initial={modal.payload}
            submitting={saving}
            onSubmit={(body) =>
              save(() => (modal.payload ? api.put(`/leads/${modal.payload.id}`, body) : api.post("/leads", body)))
            }
          />
        </Modal>
      )}
      {modal?.type === "followup" && (
        <Modal title={modal.payload ? "Edit Follow-up" : "Add Follow-up"} onClose={closeModal}>
          <FollowUpForm
            initial={modal.payload}
            submitting={saving}
            onSubmit={(body) =>
              save(() => (modal.payload ? api.put(`/follow-ups/${modal.payload.id}`, body) : api.post("/follow-ups", body)))
            }
          />
        </Modal>
      )}
      {modal?.type === "view-client" && <ClientView id={modal.payload?.id} onClose={closeModal} onCreateInvoice={(id) => { closeModal(); openModal("invoice", { client_id: id }); }} onInvoice={(id) => { closeModal(); navigate(`/invoices?invoice=${id}`); }} />}
      {modal?.type === "view-booking" && <BookingView id={modal.payload?.id} onClose={closeModal} />}
      {modal?.type === "view-package" && <ViewModal title="Package details" data={modal.payload} onClose={closeModal} />}
      {modal?.type === "view-inventory" && <ViewModal title="Inventory details" data={modal.payload} onClose={closeModal} />}
      {modal?.type === "view-lead" && <ViewModal title="Lead details" data={modal.payload} onClose={closeModal} />}
      {modal?.type === "view-followup" && <ViewModal title="Follow-up details" data={modal.payload} onClose={closeModal} />}
      {modal?.type === "message" && <MessageCompose onClose={closeModal} />}

      <ConfirmModal
        open={Boolean(confirm)}
        title={confirm?.title || "Delete record"}
        message={confirm?.message || "This record will be permanently deleted from the database."}
        onCancel={() => setConfirm(null)}
        onConfirm={onConfirmDelete}
        loading={deleting}
      />
    </>
  );
}

function ViewModal({ title, data, onClose }) {
  const entries = Object.entries(data || {}).filter(([k]) => !["password_hash"].includes(k));
  return (
    <Modal title={title} onClose={onClose}>
      <dl className="grid gap-3 sm:grid-cols-2">
        {entries.map(([k, v]) => (
          <div key={k}>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{k.replaceAll("_", " ")}</dt>
            <dd className="mt-1 text-sm font-medium text-slate-700">{formatValue(v)}</dd>
          </div>
        ))}
      </dl>
    </Modal>
  );
}

function BookingView({ id, onClose }) {
  const { openModal } = useUi();
  const q = useQuery({
    queryKey: ["booking", id],
    enabled: Boolean(id),
    queryFn: async () => (await api.get(`/bookings/${id}`)).data,
  });
  return (
    <Modal title="Booking details" onClose={onClose} wide>
      {q.isLoading ? <p className="text-sm text-slate-400">Loading...</p> : q.data ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge value={q.data.status} />
            <StatusBadge value={q.data.payment_status} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Info label="Client" value={q.data.client_name} />
            <Info label="Package" value={q.data.package_name} />
            <Info label="Destination" value={q.data.destination_name} />
            <Info label="Agent" value={q.data.agent_name} />
            <Info label="Departure" value={formatDate(q.data.departure_date)} />
            <Info label="Return" value={formatDate(q.data.return_date)} />
            <Info label="Travelers" value={q.data.travelers} />
            <Info label="Amount" value={money(q.data.total_amount)} />
          </div>
          {q.data.notes ? <p className="text-sm text-slate-500">{q.data.notes}</p> : null}
          <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <h4 className="text-sm font-bold text-slate-800">Invoices ({q.data.invoices?.length || 0})</h4>
            <button className="btn-primary w-full sm:w-auto" onClick={() => openModal("invoice", { bookingId: q.data.id })}><span className="text-base leading-none">+</span> Create Invoice</button>
          </div>
          {q.data.invoices?.length ? (
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-100">
              {q.data.invoices.map((invoice) => (
                <div key={invoice.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                  <div><p className="font-semibold text-slate-700">{invoice.invoice_number}</p><p className="text-xs text-slate-400">Due {formatDate(invoice.due_date)}</p></div>
                  <div className="text-right"><StatusBadge value={invoice.status} /><p className="mt-1 font-semibold">{money(invoice.total)}</p></div>
                </div>
              ))}
            </div>
          ) : <p className="text-xs text-slate-400">No invoices linked to this booking yet.</p>}
        </div>
      ) : (
        <p className="text-sm text-slate-400">Booking not found</p>
      )}
    </Modal>
  );
}

function ClientView({ id, onClose, onCreateInvoice, onInvoice }) {
  const q = useQuery({
    queryKey: ["client", id],
    enabled: Boolean(id),
    queryFn: async () => (await api.get(`/clients/${id}`)).data,
  });
  const client = q.data;
  return (
    <Modal title="Client details" onClose={onClose} wide>
      {q.isLoading ? <p className="text-sm text-slate-400">Loading client...</p> : !client ? <p className="text-sm text-slate-400">Client not found</p> : (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Info label="Name" value={client.full_name} />
            <Info label="Phone" value={client.phone} />
            <Info label="Email" value={client.email} />
            <Info label="Address" value={client.address} />
          </div>
          <div className="space-y-3 border-t border-slate-100 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-bold text-slate-800">Invoice history ({client.invoices?.length || 0})</h4><button className="btn-primary !px-3 !py-2 text-xs" onClick={() => onCreateInvoice(client.id)}><span className="text-base leading-none">+</span> Create Invoice</button></div>
            {client.invoices?.length ? client.invoices.map((invoice) => (
              <button key={invoice.id} className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-100 p-3 text-left hover:bg-slate-50" onClick={() => onInvoice(invoice.id)}>
                <span><span className="block text-sm font-semibold text-brand-700">{invoice.invoice_number}</span><span className="text-xs text-slate-400">Issued {formatDate(invoice.issue_date)} · Due {formatDate(invoice.due_date)}</span></span>
                <span className="text-right"><StatusBadge value={invoice.status} /><span className="mt-1 block text-sm font-semibold text-slate-700">{money(invoice.total)}</span></span>
              </button>
            )) : <p className="text-xs text-slate-400">No invoices linked to this client yet.</p>}
          </div>
        </div>
      )}
    </Modal>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-700">{value || "—"}</p>
    </div>
  );
}

function MessageCompose({ onClose }) {
  const { toast, invalidateAll } = useUi();
  const [clientId, setClientId] = useState("");
  const [body, setBody] = useState("");
  const clients = useQuery({ queryKey: ["clients-all"], queryFn: async () => (await api.get("/clients", { params: { limit: 50 } })).data.data });
  const send = useMutation({
    mutationFn: () => api.post("/messages", { client_id: clientId, body }),
    onSuccess: () => {
      invalidateAll(saveQueryKeys.message);
      toast("Message sent");
      onClose();
    },
    onError: (err) => toast(errorMessage(err), "error"),
  });
  return (
    <Modal title="Send Message" onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          send.mutate();
        }}
      >
        <div>
          <label className="label">Client *</label>
          <select className="input" required value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">Select client</option>
            {(clients.data || []).map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Message *</label>
          <textarea className="input min-h-[120px]" required value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
        <div className="flex justify-end">
          <button className="btn-primary" disabled={send.isPending}>{send.isPending ? "Sending..." : "Send"}</button>
        </div>
      </form>
    </Modal>
  );
}

function formatValue(v) {
  if (v == null || v === "") return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
