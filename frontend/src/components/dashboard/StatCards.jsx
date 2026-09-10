import { Briefcase, CalendarCheck, Package, Users } from "lucide-react";
import { money } from "../../api/client";

const cards = [
  { key: "totalClients", label: "Total Clients", icon: Users, color: "bg-blue-50 text-brand-600", changeKey: "clientsChange" },
  { key: "totalBookings", label: "Total Bookings", icon: CalendarCheck, color: "bg-orange-50 text-orange-500", changeKey: "bookingsChange" },
  { key: "activePackages", label: "Active Packages", icon: Package, color: "bg-indigo-50 text-indigo-500", changeKey: "packagesChange" },
  { key: "totalRevenue", label: "Total Revenue", icon: Briefcase, color: "bg-emerald-50 text-emerald-600", changeKey: "revenueChange", money: true },
];

export default function StatCards({ stats }) {
  return (
    <div className="grid w-full min-w-0 grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        const value = stats?.[card.key] ?? 0;
        const change = stats?.[card.changeKey];
        const display = card.money ? money(value) : Number(value).toLocaleString();
        return (
          <div key={card.key} className="card min-w-0 overflow-hidden p-4">
            <div className="flex items-start gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${card.color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-slate-400">{card.label}</p>
                <p
                  title={display}
                  className="mt-1 break-words text-lg font-extrabold leading-tight tracking-tight text-slate-800 sm:text-xl"
                >
                  {display}
                </p>
                {change != null && (
                  <p className={`mt-0.5 truncate text-[11px] font-semibold ${change >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                    {change >= 0 ? "+" : ""}{change}% vs last 30 days
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
