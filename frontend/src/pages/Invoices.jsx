import { useEffect, useState } from "react";
import {
  ArrowDownUp, CalendarDays, Check, CircleDollarSign, Clock3,
  Download, Ellipsis, FilePlus2, FileText, MapPin, Pencil, Printer, Search,
  Send, ShieldCheck, Wallet,
} from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import api, { errorMessage, formatDate, money } from "../api/client";
import { useDebounce } from "../hooks/useDebounce";
import { useUi } from "../context/UiContext";
import { useAuth } from "../context/AuthContext";
import { EmptyState, Loader, Pagination, StatusBadge } from "../components/ui/Common";
import { downloadInvoicePdf, printInvoice } from "../utils/invoicePdf";

const statuses = ["all", "paid", "pending", "overdue", "cancelled"];
const sorts = [
  ["newest", "Newest first"],
  ["oldest", "Oldest first"],
  ["amount_desc", "Amount: high to low"],
  ["amount_asc", "Amount: low to high"],
];

function Metric({ icon: Icon, label, value, note, color }) {
  return (
    <div className="card flex min-w-0 items-center gap-3 p-4 sm:gap-4 sm:p-5">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-11 sm:w-11 ${color}`}><Icon className="h-5 w-5" /></div>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-slate-500">{label}</p>
        <p className="mt-1 truncate text-lg font-extrabold text-slate-800 sm:text-xl">{value}</p>
        <p className="mt-0.5 truncate text-[11px] text-slate-400">{note}</p>
      </div>
    </div>
  );
}

function ActionButton({ title, onClick, children, disabled = false, tone = "slate" }) {
  const tones = { slate: "text-slate-500 hover:bg-slate-100", blue: "text-brand-600 hover:bg-brand-50", green: "text-emerald-600 hover:bg-emerald-50", red: "text-red-500 hover:bg-red-50" };
  return <button type="button" title={title} aria-label={title} disabled={disabled} onClick={onClick} className={`rounded-lg p-2 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${tones[tone]}`}><span className="flex h-4 w-4 items-center justify-center">{children}</span></button>;
}

function InvoiceQr({ invoice }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let active = true;
    import("qrcode").then(({ default: QRCode }) => QRCode.toDataURL(
      `Invoice reference: ${invoice.invoice_number}\nTotal: ${invoice.total}`,
      { width: 112, margin: 1, color: { dark: "#1d4ed8", light: "#ffffff" } }
    )).then((dataUrl) => { if (active) setSrc(dataUrl); }).catch(() => {});
    return () => { active = false; };
  }, [invoice.invoice_number, invoice.total]);
  return src ? <img src={src} alt={`QR code for invoice ${invoice.invoice_number}`} className="h-14 w-14 rounded-lg bg-white p-1" /> : <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-white text-brand-600"><ShieldCheck className="h-8 w-8" /></div>;
}

function InvoicePreview({ invoice, settings, onEdit, onPayment, onStatus, onSend, onDownload, onPrint, busy }) {
  if (!invoice) {
    return <div className="card flex min-h-[420px] items-center justify-center p-5"><EmptyState title="Select an invoice" hint="Choose an invoice to review its travel and payment details." /></div>;
  }
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const remaining = Math.max(0, Number(invoice.total) - Number(invoice.amount_paid || 0));
  const company = settings?.company_name || "Travel Agency";
  return (
    <section className="card min-w-0 overflow-hidden" aria-label="Invoice preview">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2"><FileText className="h-4 w-4 shrink-0 text-brand-600" /><h2 className="truncate text-sm font-bold text-slate-800">Invoice preview</h2></div>
        <StatusBadge value={invoice.status} />
      </div>
      <div className="p-4 sm:p-5">
        <div className="rounded-xl bg-brand-600 px-4 py-4 text-white sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {settings?.logo ? <img src={settings.logo} alt={company} className="mb-2 max-h-8 max-w-24 rounded bg-white/95 object-contain p-1" /> : <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-white/15"><MapPin className="h-4 w-4" /></div>}
              <p className="break-words text-sm font-bold">{company}</p>
              <p className="mt-0.5 text-[10px] uppercase text-white/70">Travel services</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[10px] font-semibold uppercase text-white/70">Invoice</p>
              <p className="mt-1 max-w-[155px] break-all text-sm font-bold">{invoice.invoice_number}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/20 pt-3 text-xs">
            <div><p className="text-white/65">Issue date</p><p className="mt-1 font-semibold">{formatDate(invoice.issue_date)}</p></div>
            <div><p className="text-white/65">Due date</p><p className="mt-1 font-semibold">{formatDate(invoice.due_date)}</p></div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase text-slate-400">Bill to</p>
            <p className="mt-1 break-words text-sm font-bold text-slate-800">{invoice.client_name || "Client"}</p>
            <p className="break-all text-xs text-slate-500">{invoice.client_email || "Email not recorded"}</p>
            <p className="text-xs text-slate-500">{invoice.client_phone || "Phone not recorded"}</p>
            {invoice.client_address ? <p className="mt-1 break-words text-xs text-slate-500">{invoice.client_address}</p> : null}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase text-slate-400">Trip details</p>
            <p className="mt-1 break-words text-sm font-semibold text-slate-800">{invoice.booking_label || "Independent invoice"}</p>
            <p className="mt-1 text-xs text-slate-500">{invoice.destination || "Destination not recorded"}</p>
            <p className="text-xs text-slate-500">{invoice.travel_start_date || invoice.travel_end_date ? `${formatDate(invoice.travel_start_date)} – ${formatDate(invoice.travel_end_date)}` : "Travel dates not recorded"}</p>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-xl border border-slate-100">
          <div className="grid grid-cols-[minmax(0,1fr)_45px_90px] gap-2 bg-slate-50 px-3 py-2 text-[9px] font-bold uppercase text-slate-400">
            <span>Service</span><span className="text-right">Qty</span><span className="text-right">Amount</span>
          </div>
          {items.length ? items.map((item, index) => (
            <div key={`${item.description}-${index}`} className="grid grid-cols-[minmax(0,1fr)_45px_90px] gap-2 border-t border-slate-100 px-3 py-2.5 text-xs">
              <span className="break-words font-medium text-slate-700">{item.description}</span>
              <span className="text-right text-slate-500">{item.quantity}</span>
              <span className="text-right font-semibold text-slate-700">{money(item.total ?? Number(item.quantity) * Number(item.unitPrice ?? item.unit_price))}</span>
            </div>
          )) : <p className="px-3 py-4 text-xs text-slate-400">No line items available.</p>}
        </div>

        <div className="ml-auto mt-4 max-w-xs space-y-1.5 text-xs">
          <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>{money(invoice.subtotal)}</span></div>
          {Number(invoice.discount) ? <div className="flex justify-between text-slate-500"><span>Discount</span><span>− {money(invoice.discount)}</span></div> : null}
          {Number(invoice.tax) ? <div className="flex justify-between text-slate-500"><span>Tax</span><span>{money(invoice.tax)}</span></div> : null}
          <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-extrabold text-slate-800"><span>Total</span><span>{money(invoice.total)}</span></div>
          <div className="flex justify-between text-slate-500"><span>Paid</span><span>{money(invoice.amount_paid || 0)}</span></div>
          <div className="flex justify-between font-bold text-brand-700"><span>Remaining</span><span>{money(remaining)}</span></div>
        </div>

        <div className="mt-4 grid gap-3 rounded-xl border border-dashed border-brand-200 bg-brand-50/60 p-3 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase text-brand-700">Payment reference</p>
            <p className="mt-1 break-all font-mono text-xs font-semibold text-slate-700">{invoice.invoice_number}</p>
            <p className="mt-1 text-[10px] text-slate-500">{invoice.payment_method ? `Method: ${invoice.payment_method}` : "Payment method not recorded"}{invoice.payment_date ? ` · ${formatDate(invoice.payment_date)}` : ""}</p>
          </div>
          <InvoiceQr invoice={invoice} />
        </div>
        {invoice.payments?.length ? <div className="mt-4 space-y-2">
          <p className="text-[10px] font-bold uppercase text-slate-400">Payment history</p>
          {invoice.payments.map((entry) => <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs"><span className="text-slate-500">{formatDate(entry.payment_date)}{entry.payment_method ? ` · ${entry.payment_method}` : ""}{entry.reference ? ` · ${entry.reference}` : ""}</span><strong className="text-emerald-700">{money(entry.amount)}</strong></div>)}
        </div> : null}
        {invoice.notes ? <p className="mt-4 whitespace-pre-wrap break-words text-xs leading-5 text-slate-500"><span className="font-bold text-slate-600">Notes & terms: </span>{invoice.notes}</p> : null}
        <p className="mt-4 border-t border-slate-100 pt-3 text-center text-xs font-semibold text-brand-700">Thank you for travelling with us.</p>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          <button className="btn-primary flex-1 !px-3 !py-2 text-xs" onClick={onDownload}><Download className="h-4 w-4" /> PDF</button>
          <button className="btn-secondary flex-1 !px-3 !py-2 text-xs" onClick={onPrint}><Printer className="h-4 w-4" /> Print</button>
          <button className="btn-secondary flex-1 !px-3 !py-2 text-xs" disabled={busy} onClick={onSend}><Send className="h-4 w-4" /> Send</button>
          <button className="btn-secondary flex-1 !px-3 !py-2 text-xs" onClick={onEdit}>Edit</button>
          {invoice.status !== "paid" && invoice.status !== "cancelled" ? <button className="btn-secondary w-full !px-3 !py-2 text-xs text-emerald-700 sm:w-auto" onClick={onPayment}><Wallet className="h-4 w-4" /> Record payment</button> : null}
          {invoice.status !== "paid" && invoice.status !== "cancelled" ? <button className="btn-secondary w-full !px-3 !py-2 text-xs sm:w-auto" disabled={remaining <= 0} onClick={() => onStatus("paid")}><Check className="h-4 w-4" /> Mark paid</button> : null}
        </div>
      </div>
    </section>
  );
}

export default function Invoices() {
  const { openModal, askConfirm, invalidateAll, toast } = useUi();
  const { settings, user } = useAuth();
  const invoiceBrand = { ...settings, contact_email: user?.email, contact_phone: user?.phone };
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState([]);
  const debouncedSearch = useDebounce(search);
  const requestedInvoice = searchParams.get("invoice");
  const list = useQuery({
    queryKey: ["invoices", debouncedSearch, status, dateFrom, dateTo, sort, page],
    queryFn: async () => (await api.get("/invoices", { params: {
      q: debouncedSearch || undefined,
      status: status === "all" ? undefined : status,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      sort,
      page,
      limit: 8,
    } })).data,
  });
  const summary = useQuery({ queryKey: ["invoices-summary"], queryFn: async () => (await api.get("/invoices/summary")).data });
  const selectedId = requestedInvoice || (list.data?.data?.[0]?.id ? String(list.data.data[0].id) : "");
  const selectedRow = (list.data?.data || []).find((invoice) => String(invoice.id) === String(selectedId));
  const detail = useQuery({
    queryKey: ["invoice", selectedId],
    enabled: Boolean(selectedId),
    queryFn: async () => (await api.get(`/invoices/${selectedId}`)).data,
  });
  const invoice = detail.data || selectedRow;
  const payment = useMutation({
    mutationFn: ({ id, action }) => api.patch(`/invoices/${id}/payment`, { action }),
    onSuccess: (_, variables) => {
      invalidateAll([["invoices"], ["invoice"], ["invoices-summary"], ["bookings"], ["booking"]]);
      toast(variables.action === "paid" ? "Invoice marked as paid" : `Invoice marked ${variables.action}`);
    },
    onError: (error) => toast(errorMessage(error), "error"),
  });
  const send = useMutation({
    mutationFn: (id) => api.post(`/invoices/${id}/send`),
    onSuccess: (result) => {
      invalidateAll([["conversations"], ["thread"], ["messages-unread"]]);
      toast(result.data.message || "Invoice shared in the client conversation");
    },
    onError: (error) => toast(errorMessage(error), "error"),
  });

  useEffect(() => {
    if (requestedInvoice || !list.data?.data?.length) return;
    const next = new URLSearchParams(searchParams);
    next.set("invoice", String(list.data.data[0].id));
    setSearchParams(next, { replace: true });
  }, [requestedInvoice, list.data, searchParams, setSearchParams]);

  function selectInvoice(id) {
    const next = new URLSearchParams(searchParams);
    next.set("invoice", String(id));
    setSearchParams(next, { replace: true });
  }

  function openCreate() {
    openModal("invoice");
  }

  function editInvoice(target = invoice) {
    if (target) openModal("invoice", { invoice: target });
  }

  function download(target = invoice) {
    if (target) downloadInvoicePdf(target, invoiceBrand).catch((error) => toast(errorMessage(error, "Could not generate invoice PDF"), "error"));
  }

  function print(target = invoice) {
    if (target && !printInvoice(target, invoiceBrand)) toast("Allow pop-ups to print this invoice", "error");
  }

  function setFilter(setter, value) {
    setter(value);
    setPage(1);
  }

  function deleteInvoice(target) {
    askConfirm({
      title: "Delete invoice",
      message: `${target.invoice_number} and its payment records will be permanently deleted. The linked booking payment status will be recalculated.`,
      onConfirm: async () => {
        await api.delete(`/invoices/${target.id}`);
        if (String(target.id) === String(selectedId)) {
          const next = new URLSearchParams(searchParams);
          next.delete("invoice");
          setSearchParams(next, { replace: true });
        }
      },
    });
  }

  const isFiltered = Boolean(debouncedSearch || status !== "all" || dateFrom || dateTo);
  const setAllVisible = (checked) => setSelectedIds(checked ? (list.data?.data || []).map((row) => row.id) : []);
  const resetFilters = () => {
    setSearch("");
    setStatus("all");
    setDateFrom("");
    setDateTo("");
    setSort("newest");
    setPage(1);
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      <header className="flex flex-col gap-3 rounded-2xl border border-white bg-white px-4 py-4 shadow-card sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><FileText className="h-4 w-4" /></span><h1 className="text-lg font-extrabold text-slate-800">Invoices</h1></div>
          <p className="mt-1 text-xs text-slate-500">Create, manage and track all travel invoices in one place.</p>
        </div>
        <button className="btn-primary w-full sm:w-auto" onClick={openCreate}><FilePlus2 className="h-4 w-4" /> Create Invoice</button>
      </header>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Metric icon={FileText} label="Total Invoices" value={summary.isLoading ? "—" : Number(summary.data?.totalInvoices || 0).toLocaleString()} note="Across all invoice records" color="bg-blue-50 text-blue-700" />
        <Metric icon={CircleDollarSign} label="Total Amount" value={summary.isLoading ? "—" : money(summary.data?.totalAmount || 0)} note="Invoice value issued" color="bg-indigo-50 text-indigo-700" />
        <Metric icon={Check} label="Paid Invoices" value={summary.isLoading ? "—" : Number(summary.data?.paidInvoices || 0).toLocaleString()} note="Settled in full" color="bg-emerald-50 text-emerald-700" />
        <Metric icon={Clock3} label="Pending Invoices" value={summary.isLoading ? "—" : Number(summary.data?.pendingInvoices || 0).toLocaleString()} note="Awaiting payment" color="bg-orange-50 text-orange-700" />
      </section>

      <div className="flex flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.9fr)] xl:items-start">
        <section className="card min-w-0 overflow-hidden">
          <div className="space-y-3 border-b border-slate-100 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><h2 className="text-sm font-bold text-slate-800">Invoice register</h2><p className="mt-0.5 text-xs text-slate-400">{list.data ? `${list.data.total} invoices` : "Latest invoices"}</p></div>
              {selectedIds.length ? <button className="text-xs font-semibold text-brand-600 hover:text-brand-800" onClick={() => setSelectedIds([])}>{selectedIds.length} selected · Clear</button> : null}
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(155px,1fr)_145px_130px_130px]">
              <label className="relative min-w-0"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input className="input !pl-9" placeholder="Invoice, client, booking..." value={search} onChange={(event) => { setFilter(setSearch, event.target.value); }} /></label>
              <select className="input" value={status} onChange={(event) => setFilter(setStatus, event.target.value)} aria-label="Filter invoices by status">{statuses.map((item) => <option key={item} value={item}>{item === "all" ? "All statuses" : `${item[0].toUpperCase()}${item.slice(1)}`}</option>)}</select>
              <label className="relative"><CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input className="input !pl-9" type="date" aria-label="Issue date from" value={dateFrom} onChange={(event) => setFilter(setDateFrom, event.target.value)} /></label>
              <label className="relative"><CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input className="input !pl-9" type="date" aria-label="Issue date to" value={dateTo} min={dateFrom || undefined} onChange={(event) => setFilter(setDateTo, event.target.value)} /></label>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                {statuses.map((item) => <button key={item} className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold capitalize transition-colors ${status === item ? "bg-brand-50 text-brand-700" : "text-slate-500 hover:bg-slate-50"}`} onClick={() => setFilter(setStatus, item)}>{item}</button>)}
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-500"><ArrowDownUp className="h-3.5 w-3.5" /><select className="max-w-[155px] border-0 bg-transparent py-1 text-xs font-semibold text-slate-600 focus:ring-0" value={sort} onChange={(event) => setFilter(setSort, event.target.value)}>{sorts.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            </div>
          </div>

          {list.isPending && !list.data ? <Loader label="Loading invoices..." /> : list.isError ? (
            <div className="p-6 text-center"><p className="text-sm font-semibold text-slate-700">Invoices could not be loaded</p><p className="mt-1 text-xs text-slate-400">{errorMessage(list.error)}</p><button className="btn-secondary mt-3" onClick={() => list.refetch()}>Try again</button></div>
          ) : !list.data?.data?.length ? (
            isFiltered ? <div className="p-5"><EmptyState title="No matching invoices" hint="Try another search or adjust the filters." /><div className="text-center"><button className="text-xs font-semibold text-brand-600" onClick={resetFilters}>Clear filters</button></div></div> : <div className="p-5"><EmptyState title="No invoices yet" hint="Create an invoice from a booking or start a new invoice here." /><div className="text-center"><button className="btn-primary mt-2" onClick={openCreate}><FilePlus2 className="h-4 w-4" /> Create Invoice</button></div></div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[930px] text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] uppercase text-slate-400">
                    <tr><th className="w-10 px-3 py-3"><input type="checkbox" aria-label="Select visible invoices" checked={Boolean(list.data.data.length && list.data.data.every((row) => selectedIds.includes(row.id)))} onChange={(event) => setAllVisible(event.target.checked)} /></th><th className="px-3 py-3">Invoice No.</th><th className="px-3 py-3">Client / Trip</th><th className="px-3 py-3">Amount</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Issue date</th><th className="px-3 py-3">Due date</th><th className="px-3 py-3 text-right">Actions</th></tr>
                  </thead>
                  <tbody>
                    {list.data.data.map((row) => <tr key={row.id} className={`border-t border-slate-100 transition-colors ${String(row.id) === String(selectedId) ? "bg-brand-50/50" : "hover:bg-slate-50/70"}`}>
                      <td className="px-3 py-3"><input type="checkbox" aria-label={`Select ${row.invoice_number}`} checked={selectedIds.includes(row.id)} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...new Set([...current, row.id])] : current.filter((id) => id !== row.id))} /></td>
                      <td className="px-3 py-3"><button className="font-bold text-brand-700 hover:underline" onClick={() => selectInvoice(row.id)}>{row.invoice_number}</button><p className="mt-1 text-[10px] text-slate-400">#{row.booking_id || "Unlinked"}</p></td>
                      <td className="max-w-[180px] px-3 py-3"><p className="truncate font-semibold text-slate-700">{row.client_name || "Client removed"}</p><p className="mt-1 truncate text-[10px] text-slate-400">{row.destination || row.booking_label || "Trip not specified"}</p></td>
                      <td className="whitespace-nowrap px-3 py-3 font-bold text-slate-700">{money(row.total)}<p className="mt-1 text-[10px] font-normal text-slate-400">Due {money(Math.max(0, Number(row.total) - Number(row.amount_paid || 0)))}</p></td>
                      <td className="px-3 py-3"><StatusBadge value={row.status} /></td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-500">{formatDate(row.issue_date)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-500">{formatDate(row.due_date)}</td>
                      <td className="px-3 py-3"><div className="flex justify-end gap-0.5">
                        <ActionButton title="View invoice" onClick={() => selectInvoice(row.id)} tone="blue"><FileText className="h-4 w-4" /></ActionButton>
                        <ActionButton title="Edit invoice" onClick={() => editInvoice(row)}><Pencil className="h-4 w-4" /></ActionButton>
                        <ActionButton title="Download PDF" onClick={() => download(row)}><Download className="h-4 w-4" /></ActionButton>
                        <ActionButton title="Send to client" onClick={() => send.mutate(row.id)} disabled={send.isPending}><Send className="h-4 w-4" /></ActionButton>
                        <details className="relative">
                          <summary className="flex cursor-pointer list-none rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="More invoice actions"><Ellipsis className="h-4 w-4" /></summary>
                          <div className="absolute right-0 z-20 mt-1 w-48 rounded-xl border border-slate-100 bg-white p-1.5 shadow-lg">
                            <button className="w-full rounded-lg px-3 py-2 text-left text-xs text-slate-600 hover:bg-slate-50" onClick={() => print(row)}>Print invoice</button>
                            {row.status !== "paid" && row.status !== "cancelled" ? <button className="w-full rounded-lg px-3 py-2 text-left text-xs text-emerald-700 hover:bg-emerald-50" onClick={() => payment.mutate({ id: row.id, action: "paid" })}>Mark as paid</button> : null}
                            {row.status !== "cancelled" && Number(row.amount_paid) < Number(row.total) ? <button className="w-full rounded-lg px-3 py-2 text-left text-xs text-orange-700 hover:bg-orange-50" onClick={() => payment.mutate({ id: row.id, action: "pending" })}>Mark as pending</button> : null}
                            {row.status !== "cancelled" && Number(row.amount_paid) < Number(row.total) ? <button className="w-full rounded-lg px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50" onClick={() => payment.mutate({ id: row.id, action: "overdue" })}>Mark as overdue</button> : null}
                            {row.status !== "cancelled" ? <button className="w-full rounded-lg px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50" onClick={() => askConfirm({ title: "Cancel invoice", message: `Cancel ${row.invoice_number}? Its payment history will be kept.`, onConfirm: () => api.patch(`/invoices/${row.id}/payment`, { action: "cancelled" }) })}>Cancel invoice</button> : null}
                            <button className="w-full rounded-lg px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50" onClick={() => deleteInvoice(row)}>Delete invoice</button>
                          </div>
                        </details>
                      </div></td>
                    </tr>)}
                  </tbody>
                </table>
              </div>

              <div className="space-y-2 p-3 md:hidden">
                {list.data.data.map((row) => <article key={row.id} className={`rounded-xl border p-3 ${String(row.id) === String(selectedId) ? "border-brand-200 bg-brand-50/40" : "border-slate-100 bg-white"}`}>
                  <div className="flex items-start gap-2">
                    <input className="mt-1" type="checkbox" aria-label={`Select ${row.invoice_number}`} checked={selectedIds.includes(row.id)} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...new Set([...current, row.id])] : current.filter((id) => id !== row.id))} />
                    <button className="min-w-0 flex-1 text-left" onClick={() => selectInvoice(row.id)}><span className="flex flex-wrap items-center justify-between gap-2"><span className="break-all text-sm font-bold text-brand-700">{row.invoice_number}</span><StatusBadge value={row.status} /></span><span className="mt-1 block truncate text-xs font-semibold text-slate-700">{row.client_name || "Client removed"}</span><span className="mt-0.5 block truncate text-[11px] text-slate-400">{row.destination || row.booking_label || "Trip not specified"}</span></button>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5"><div><p className="text-sm font-extrabold text-slate-800">{money(row.total)}</p><p className="text-[10px] text-slate-400">Due {formatDate(row.due_date)}</p></div><div className="flex gap-0.5"><ActionButton title="View invoice" onClick={() => selectInvoice(row.id)} tone="blue"><FileText className="h-4 w-4" /></ActionButton><ActionButton title="Edit invoice" onClick={() => editInvoice(row)}><Pencil className="h-4 w-4" /></ActionButton><ActionButton title="Download PDF" onClick={() => download(row)}><Download className="h-4 w-4" /></ActionButton><ActionButton title="Send to client" onClick={() => send.mutate(row.id)}><Send className="h-4 w-4" /></ActionButton><details className="relative"><summary className="flex cursor-pointer list-none rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="More invoice actions"><Ellipsis className="h-4 w-4" /></summary><div className="absolute right-0 z-20 mt-1 w-44 rounded-xl border border-slate-100 bg-white p-1.5 shadow-lg"><button className="w-full rounded-lg px-3 py-2 text-left text-xs text-slate-600 hover:bg-slate-50" onClick={() => print(row)}>Print invoice</button>{row.status !== "paid" && row.status !== "cancelled" && Number(row.amount_paid) < Number(row.total) ? <><button className="w-full rounded-lg px-3 py-2 text-left text-xs text-orange-700 hover:bg-orange-50" onClick={() => payment.mutate({ id: row.id, action: "pending" })}>Mark pending</button><button className="w-full rounded-lg px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50" onClick={() => payment.mutate({ id: row.id, action: "overdue" })}>Mark overdue</button></> : null}<button className="w-full rounded-lg px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50" onClick={() => deleteInvoice(row)}>Delete invoice</button></div></details></div></div>
                </article>)}
              </div>
              <Pagination page={page} limit={8} total={list.data.total} onPage={setPage} />
            </>
          )}
        </section>

        <div className="min-w-0 xl:sticky xl:top-4">
          {detail.isError && !selectedRow ? <div className="card p-5 text-center"><p className="text-sm font-semibold text-slate-700">Invoice details unavailable</p><button className="btn-secondary mt-3" onClick={() => detail.refetch()}>Try again</button></div> : detail.isLoading && !selectedRow ? <div className="card"><Loader label="Loading invoice..." /></div> : (
            <InvoicePreview
              invoice={invoice}
              settings={invoiceBrand}
              busy={send.isPending}
              onEdit={() => editInvoice(invoice)}
              onPayment={() => openModal("invoice-payment", invoice)}
              onStatus={(action) => payment.mutate({ id: invoice.id, action })}
              onSend={() => send.mutate(invoice.id)}
              onDownload={() => download(invoice)}
              onPrint={() => print(invoice)}
            />
          )}
        </div>
      </div>
    </div>
  );
}