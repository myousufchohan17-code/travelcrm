import { useEffect, useRef, useState } from "react";
import { Bell, CalendarDays, ChevronDown, Menu, Search, UserRound } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import api, { formatDate } from "../../api/client";
import { useDebounce } from "../../hooks/useDebounce";
import { useAuth } from "../../context/AuthContext";
import { useUi } from "../../context/UiContext";
import { initials } from "../ui/Common";

const typePath = {
  clients: "/clients",
  bookings: "/bookings",
  packages: "/packages",
  leads: "/leads",
  destinations: "/destinations",
  agents: "/agents",
};

export default function Navbar() {
  const { user } = useAuth();
  const { setSidebarOpen, toast } = useUi();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [openSearch, setOpenSearch] = useState(false);
  const [openBell, setOpenBell] = useState(false);
  const [openUser, setOpenUser] = useState(false);
  const [openCal, setOpenCal] = useState(false);
  const [dateValue, setDateValue] = useState(new Date().toISOString().slice(0, 10));
  const debounced = useDebounce(q, 350);
  const wrapRef = useRef(null);

  const search = useQuery({
    queryKey: ["search", debounced],
    enabled: debounced.length >= 2,
    queryFn: async () => (await api.get("/search", { params: { q: debounced } })).data,
  });

  const notifications = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => (await api.get("/notifications")).data,
  });
  const unread = useQuery({
    queryKey: ["notifications-unread"],
    queryFn: async () => (await api.get("/notifications/unread-count")).data.count,
  });
  const markAll = useMutation({
    mutationFn: () => api.patch("/notifications/read-all"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-unread"] });
    },
  });

  useEffect(() => {
    function onDoc(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpenSearch(false);
        setOpenBell(false);
        setOpenUser(false);
        setOpenCal(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const groups = search.data || {};
  const hasResults = Object.values(groups).some((arr) => arr?.length);

  function go(type, id) {
    setOpenSearch(false);
    setQ("");
    navigate(typePath[type] || "/");
    if (id) toast("Record found. Open it from the list.");
  }

  return (
    <header ref={wrapRef} className="sticky top-0 z-20 flex items-center gap-2 border-b border-slate-100 bg-white/90 px-3 py-3 backdrop-blur sm:gap-3 lg:px-6">
      <button className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={() => setSidebarOpen(true)}>
        <Menu className="h-5 w-5" />
      </button>

      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpenSearch(true);
          }}
          onFocus={() => setOpenSearch(true)}
          placeholder="Search..."
          className="w-full min-w-0 rounded-full border border-slate-200 bg-slate-50 py-2 pl-10 pr-3 text-sm outline-none transition focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/10 sm:py-2.5 sm:pr-4"
        />
        {openSearch && q.length >= 2 && (
          <div className="absolute left-0 right-0 z-30 mt-2 max-h-[70vh] overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl sm:left-auto sm:right-0 sm:w-full">
            {search.isFetching ? (
              <p className="px-4 py-6 text-sm text-slate-400">Searching...</p>
            ) : !hasResults ? (
              <p className="px-4 py-6 text-sm text-slate-400">No matching records</p>
            ) : (
              <div className="max-h-96 overflow-y-auto p-2">
                {["clients", "bookings", "packages", "leads", "destinations", "agents"].map((type) =>
                  groups[type]?.length ? (
                    <div key={type} className="mb-2">
                      <p className="px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">{type}</p>
                      {groups[type].map((item) => (
                        <button
                          key={`${type}-${item.id}`}
                          onClick={() => go(type, item.id)}
                          className="flex w-full min-w-0 items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-slate-50"
                        >
                          <span className="min-w-0 truncate font-medium text-slate-700">
                            {item.full_name || item.client_name || item.name}
                          </span>
                          <span className="hidden max-w-[45%] shrink-0 truncate text-xs text-slate-400 sm:block">
                            {item.email || item.destination || item.category || item.country || item.status}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        <div className="relative">
          <button
            onClick={() => {
              setOpenBell((v) => !v);
              setOpenUser(false);
              setOpenCal(false);
            }}
            className="relative rounded-xl p-2 text-slate-500 hover:bg-slate-100"
          >
            <Bell className="h-5 w-5" />
            {Number(unread.data) > 0 && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
            )}
          </button>
          {openBell && (
            <div className="absolute right-0 z-30 mt-2 w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl">
              <div className="flex items-center justify-between px-4 py-3">
                <p className="text-sm font-bold">Notifications</p>
                <button className="text-xs font-semibold text-brand-600" onClick={() => markAll.mutate()}>
                  Mark all read
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {!notifications.data?.length ? (
                  <p className="px-4 py-8 text-center text-sm text-slate-400">No notifications yet</p>
                ) : (
                  notifications.data.map((n) => (
                    <div key={n.id} className={`border-t border-slate-50 px-4 py-3 ${n.is_read ? "opacity-60" : ""}`}>
                      <p className="text-sm font-semibold text-slate-700">{n.title}</p>
                      <p className="text-xs text-slate-400">{n.body}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="relative hidden md:block">
          <button
            onClick={() => {
              setOpenCal((v) => !v);
              setOpenBell(false);
              setOpenUser(false);
            }}
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            <CalendarDays className="h-4 w-4 text-brand-500" />
            <span className="font-medium">{formatDate(dateValue)}</span>
          </button>
          {openCal && (
            <div className="absolute right-0 mt-2 rounded-2xl border border-slate-100 bg-white p-3 shadow-xl">
              <input
                type="date"
                className="input"
                value={dateValue}
                onChange={(e) => setDateValue(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => {
              setOpenUser((v) => !v);
              setOpenBell(false);
              setOpenCal(false);
            }}
            className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-slate-100"
          >
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-xs font-bold text-brand-700">
              {user?.avatar ? <img src={user.avatar} alt="" className="h-full w-full object-cover" /> : initials(user?.full_name)}
            </div>
            <div className="hidden min-w-0 max-w-[110px] text-left md:block lg:max-w-[160px]">
              <p className="truncate text-sm font-semibold leading-4">{user?.full_name}</p>
              <p className="truncate text-[11px] capitalize text-slate-400">{user?.role}</p>
            </div>
            <ChevronDown className="hidden h-4 w-4 text-slate-400 sm:block" />
          </button>
          {openUser && (
            <div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-2xl border border-slate-100 bg-white py-1 shadow-xl">
              <button className="flex w-full items-center gap-2 px-4 py-2.5 text-sm hover:bg-slate-50" onClick={() => { setOpenUser(false); navigate("/settings"); }}>
                <UserRound className="h-4 w-4" /> Profile & settings
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
