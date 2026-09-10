import { NavLink, useLocation } from "react-router-dom";
import { useEffect } from "react";
import {
  LayoutDashboard, Users, CalendarCheck, Package, Target, Clock3,
  MessageCircle, BarChart3, Settings, MapPin, UserCheck, X,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import api from "../../api/client";
import { useUi } from "../../context/UiContext";
import logo from "../../images/logo.webp";
import sidebarArt from "../../images/sidebar.webp";

const items = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/clients", label: "Clients", icon: Users },
  { to: "/bookings", label: "Bookings", icon: CalendarCheck },
  { to: "/packages", label: "Packages", icon: Package },
  { to: "/leads", label: "Leads", icon: Target },
  { to: "/follow-ups", label: "Follow Ups", icon: Clock3 },
  { to: "/agents", label: "Assigned Agents", icon: UserCheck },
  { to: "/destinations", label: "Destinations", icon: MapPin },
  { to: "/messages", label: "Messages", icon: MessageCircle, badge: true },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const { sidebarOpen, setSidebarOpen } = useUi();
  const location = useLocation();
  const unread = useQuery({
    queryKey: ["messages-unread"],
    queryFn: async () => (await api.get("/messages/unread-count")).data.count,
  });

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  return (
    <>
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-navy-950/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[min(270px,88vw)] flex-col overflow-hidden bg-navy-900 text-white transition-transform duration-300 lg:w-[270px] lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          <div className="relative flex flex-col items-center px-5 pb-2 pt-6 text-center">
            <button
              type="button"
              className="absolute right-3 top-3 rounded-lg p-2 text-white/80 hover:bg-white/10 hover:text-white lg:hidden"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar"
            >
              <X className="h-5 w-5" />
            </button>
            <img src={logo} alt="MIA Holidays" className="sidebar-logo mx-auto" />
            <p className="mt-1 text-[11px] font-medium tracking-wide text-white/70">Travel Agency CRM</p>
          </div>

          <nav className="relative z-10 mt-3 flex-1 space-y-0.5 overflow-y-auto px-3 pb-24 sm:mt-4 sm:space-y-1 sm:pb-28">
            {items.map((item) => {
              const Icon = item.icon;
              const active = item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setSidebarOpen(false)}
                  className={`group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-300 sm:px-3.5 sm:py-2.5 ${
                    active ? "bg-brand-500 text-white shadow-lg shadow-blue-500/20" : "text-slate-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {item.badge && Number(unread.data) > 0 ? (
                    <span className="min-w-[20px] rounded-full bg-red-500 px-1.5 text-center text-[10px] font-bold leading-5">
                      {unread.data}
                    </span>
                  ) : null}
                </NavLink>
              );
            })}
          </nav>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-1/2 overflow-hidden">
          <img src={sidebarArt} alt="" className="h-full w-full max-w-none object-cover object-bottom" />
          <div className="absolute inset-0 bg-gradient-to-t from-navy-950/25 via-navy-900/35 to-navy-900" />
        </div>
      </aside>
    </>
  );
}
