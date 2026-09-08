import { useNavigate } from "react-router-dom";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { formatDate } from "../../api/client";
import { EmptyState, Loader, StatusBadge, initials } from "../ui/Common";
import { useUi } from "../../context/UiContext";
import api from "../../api/client";

export default function RecentClients({ clients, loading }) {
  const navigate = useNavigate();
  const { openModal, askConfirm } = useUi();

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-4 sm:px-5">
        <h3 className="text-base font-bold text-slate-800">Recent Clients</h3>
        <button className="text-xs font-bold text-brand-600" onClick={() => navigate("/clients")}>View All</button>
      </div>
      {loading ? <Loader /> : !clients?.length ? (
        <EmptyState title="No clients yet" hint="Add a client to see them listed here." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-5 py-3 font-semibold">Client</th>
                <th className="px-5 py-3 font-semibold">Destination</th>
                <th className="px-5 py-3 font-semibold">Travel Date</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="border-t border-slate-50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">
                        {initials(c.full_name)}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{c.full_name}</p>
                        <p className="text-xs text-slate-400">{c.email || c.phone}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{c.destination || "—"}</td>
                  <td className="px-5 py-3 text-slate-600">{formatDate(c.travel_date)}</td>
                  <td className="px-5 py-3"><StatusBadge value={c.booking_status} /></td>
                  <td className="px-5 py-3">
                    <div className="flex gap-1">
                      <IconBtn onClick={() => openModal("view-client", c)}><Eye className="h-4 w-4" /></IconBtn>
                      <IconBtn onClick={() => openModal("client", c)}><Pencil className="h-4 w-4" /></IconBtn>
                      <IconBtn
                        danger
                        onClick={() =>
                          askConfirm({
                            title: "Delete client",
                            message: `${c.full_name} will be deleted. Related follow-ups and conversations will also be removed. Bookings will keep their history without this client link.`,
                            onConfirm: () => api.delete(`/clients/${c.id}`),
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </IconBtn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function IconBtn({ children, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg p-1.5 ${danger ? "text-red-500 hover:bg-red-50" : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"}`}
    >
      {children}
    </button>
  );
}
