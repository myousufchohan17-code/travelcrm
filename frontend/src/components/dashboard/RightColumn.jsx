import { useNavigate } from "react-router-dom";
import { CalendarDays, MessageSquare, PackagePlus, UserPlus } from "lucide-react";
import { formatDate } from "../../api/client";
import { EmptyState, Loader, StatusBadge, initials } from "../ui/Common";
import { useUi } from "../../context/UiContext";

export function UpcomingBookings({ items, loading }) {
  const navigate = useNavigate();
  return (
    <div className="card p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-bold text-slate-800">Upcoming Bookings</h3>
        <button className="text-xs font-bold text-brand-600" onClick={() => navigate("/bookings")}>View All</button>
      </div>
      {loading ? <Loader /> : !items?.length ? (
        <EmptyState title="No upcoming bookings" hint="Confirmed future trips will appear here." />
      ) : (
        <div className="space-y-3">
          {items.map((b) => (
            <div key={b.id} className="flex min-w-0 items-center gap-3 rounded-2xl bg-slate-50 p-2.5">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-slate-200">
                {b.image ? <img src={b.image} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full bg-brand-100" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-800">{b.title || b.destination_name || "Booking"}</p>
                <p className="truncate text-xs text-slate-400">{b.client_name || "Unassigned client"}</p>
                <p className="text-[11px] text-slate-400">{formatDate(b.departure_date)}</p>
              </div>
              <div className="shrink-0">
                <StatusBadge value={b.status} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AssignedAgents({ items, loading }) {
  const navigate = useNavigate();
  return (
    <div className="card p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-bold text-slate-800">Assigned Agents</h3>
        <button className="text-xs font-bold text-brand-600" onClick={() => navigate("/agents")}>View All</button>
      </div>
      {loading ? <Loader /> : !items?.length ? (
        <EmptyState title="No agents yet" hint="Add an agent to assign bookings and leads." />
      ) : (
        <div className="space-y-3">
          {items.slice(0, 5).map((a) => (
            <div key={a.id} className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-50 text-xs font-bold text-brand-700">
                {a.image ? <img src={a.image} alt="" className="h-full w-full object-cover" /> : initials(a.full_name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">{a.full_name}</p>
                <p className="truncate text-xs text-slate-400">{a.email || a.phone || "No contact"}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-slate-800">{Number(a.assigned_bookings) || 0}</p>
                <p className="text-[10px] text-slate-400">bookings</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function DestinationsCard({ items, loading }) {
  const navigate = useNavigate();
  return (
    <div className="card p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-bold text-slate-800">Destinations</h3>
        <button className="text-xs font-bold text-brand-600" onClick={() => navigate("/destinations")}>View All</button>
      </div>
      {loading ? <Loader /> : !items?.length ? (
        <EmptyState title="No destinations available" hint="Add destinations with images from the Destinations page." />
      ) : (
        <div className="space-y-3">
          {items.slice(0, 5).map((d) => (
            <div key={d.id} className="flex items-center gap-3">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-slate-200">
                {d.image ? <img src={d.image} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-[10px] text-slate-400">N/A</div>}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">{d.name}</p>
                <p className="truncate text-xs text-slate-400">{d.country || "Country not set"}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-slate-800">{Number(d.bookings) || 0}</p>
                <p className="text-[10px] text-slate-400">bookings</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function TopDestinations({ items, loading }) {
  return (
    <div className="card p-4 sm:p-5">
      <h3 className="mb-4 text-base font-bold text-slate-800">Top Destinations</h3>
      {loading ? <Loader /> : !items?.length ? (
        <EmptyState title="No destinations available" hint="Rankings appear after real bookings exist." />
      ) : (
        <div className="space-y-3">
          {items.map((d) => (
            <div key={d.id} className="flex items-center gap-3">
              <div className="h-10 w-10 overflow-hidden rounded-full bg-slate-200">
                {d.image ? <img src={d.image} alt="" className="h-full w-full object-cover" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">{d.name}</p>
                <p className="text-xs text-slate-400">{d.bookings} booking{d.bookings === 1 ? "" : "s"}</p>
              </div>
              {d.growth != null && (
                <span className={`text-xs font-bold ${d.growth >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {d.growth >= 0 ? "+" : ""}{d.growth}%
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function QuickActions() {
  const { openModal } = useUi();
  const actions = [
    { label: "Add Client", icon: UserPlus, color: "bg-blue-50 text-brand-600", onClick: () => openModal("client") },
    { label: "New Booking", icon: CalendarDays, color: "bg-orange-50 text-orange-500", onClick: () => openModal("booking") },
    { label: "Create Package", icon: PackagePlus, color: "bg-indigo-50 text-indigo-500", onClick: () => openModal("package") },
    { label: "Send Message", icon: MessageSquare, color: "bg-emerald-50 text-emerald-600", onClick: () => openModal("message") },
  ];
  return (
    <div className="card p-4 sm:p-5">
      <h3 className="mb-4 text-base font-bold text-slate-800">Quick Actions</h3>
      <div className="grid grid-cols-2 gap-3">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.label}
              onClick={a.onClick}
              className="flex flex-col items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50/70 px-3 py-4 text-center hover:border-brand-100 hover:bg-white"
            >
              <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${a.color}`}>
                <Icon className="h-5 w-5" />
              </span>
              <span className="text-xs font-bold text-slate-700">{a.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
