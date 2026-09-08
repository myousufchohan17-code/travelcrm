export function StatusBadge({ value }) {
  const key = String(value || "").toLowerCase();
  const map = {
    pending: "bg-orange-50 text-orange-600",
    confirmed: "bg-blue-50 text-blue-600",
    processing: "bg-indigo-50 text-indigo-600",
    cancelled: "bg-red-50 text-red-600",
    completed: "bg-emerald-50 text-emerald-600",
    paid: "bg-emerald-50 text-emerald-600",
    unpaid: "bg-slate-100 text-slate-600",
    partial: "bg-amber-50 text-amber-600",
    refunded: "bg-rose-50 text-rose-600",
    active: "bg-emerald-50 text-emerald-600",
    inactive: "bg-slate-100 text-slate-500",
    new: "bg-sky-50 text-sky-600",
    contacted: "bg-indigo-50 text-indigo-600",
    qualified: "bg-violet-50 text-violet-600",
    converted: "bg-emerald-50 text-emerald-600",
    lost: "bg-red-50 text-red-600",
    scheduled: "bg-blue-50 text-blue-600",
    rescheduled: "bg-amber-50 text-amber-600",
  };
  return (
    <span className={`inline-flex shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${map[key] || "bg-slate-100 text-slate-600"}`}>
      {value || "—"}
    </span>
  );
}

export function EmptyState({ title, hint }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M3 7h18M5 7v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7M9 7V5a3 3 0 0 1 6 0v2" />
        </svg>
      </div>
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {hint ? <p className="mt-1 max-w-xs px-2 text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}

export function Loader({ label = "Loading..." }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-brand-500" />
      {label}
    </div>
  );
}

export function Pagination({ page, limit, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (pages <= 1) return null;
  return (
    <div className="flex flex-col gap-2 border-t border-slate-100 px-4 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <span>
        Showing {(page - 1) * limit + 1}-{Math.min(page * limit, total)} of {total}
      </span>
      <div className="flex gap-2">
        <button className="btn-secondary !py-1.5 !text-xs" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </button>
        <button className="btn-secondary !py-1.5 !text-xs" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next
        </button>
      </div>
    </div>
  );
}

export function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-navy-950/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`relative max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl ${wide ? "max-w-3xl" : "max-w-lg"}`}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-4 sm:px-5">
          <h3 className="min-w-0 truncate pr-3 text-base font-bold text-slate-800">{title}</h3>
          <button onClick={onClose} className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100">✕</button>
        </div>
        <div className="p-4 sm:p-5">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmModal({ open, title, message, onCancel, onConfirm, loading }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy-950/40" onClick={onCancel} />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="text-lg font-bold text-slate-800">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-500">{message}</p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <button className="btn-secondary w-full sm:w-auto" onClick={onCancel} disabled={loading}>Cancel</button>
          <button className="btn-danger w-full sm:w-auto" onClick={onConfirm} disabled={loading}>
            {loading ? "Deleting..." : "Confirm Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Toasts({ items }) {
  return (
    <div className="pointer-events-none fixed inset-x-3 top-3 z-[70] space-y-2 sm:inset-x-auto sm:right-5 sm:top-5 sm:max-w-sm">
      {items.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto break-words rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${
            t.type === "error" ? "bg-red-600" : "bg-emerald-600"
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}

export function initials(name) {
  return String(name || "U")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}
