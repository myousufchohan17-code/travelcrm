import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "../api/client";
import HeroSection from "../components/dashboard/HeroSection";
import StatCards from "../components/dashboard/StatCards";
import BookingsChart from "../components/dashboard/BookingsChart";
import PackagesDonut from "../components/dashboard/PackagesDonut";
import RecentClients from "../components/dashboard/RecentClients";
import {
  AssignedAgents,
  DestinationsCard,
  QuickActions,
  UpcomingBookings,
} from "../components/dashboard/RightColumn";

export default function Dashboard() {
  const [range, setRange] = useState("30d");
  const stats = useQuery({ queryKey: ["dashboard-stats"], queryFn: async () => (await api.get("/dashboard/stats")).data });
  const overview = useQuery({
    queryKey: ["bookings-overview", range],
    queryFn: async () => (await api.get("/dashboard/bookings-overview", { params: { range } })).data,
  });
  const categories = useQuery({
    queryKey: ["package-categories"],
    queryFn: async () => (await api.get("/dashboard/package-categories")).data,
  });
  const recent = useQuery({
    queryKey: ["recent-clients"],
    queryFn: async () => (await api.get("/dashboard/recent-clients")).data,
  });
  const upcoming = useQuery({
    queryKey: ["upcoming-bookings"],
    queryFn: async () => (await api.get("/dashboard/upcoming-bookings")).data,
  });
  const agents = useQuery({
    queryKey: ["agents"],
    queryFn: async () => (await api.get("/agents")).data,
  });
  const destinations = useQuery({
    queryKey: ["destinations"],
    queryFn: async () => (await api.get("/destinations")).data,
  });

  return (
    <div className="grid min-w-0 gap-4 lg:gap-5 xl:grid-cols-[minmax(0,1fr)_280px] 2xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-4 lg:space-y-5">
        <HeroSection />
        <StatCards stats={stats.data} />
        <div className="grid min-w-0 gap-4 lg:grid-cols-2 lg:gap-5">
          <BookingsChart data={overview.data} range={range} onRange={setRange} loading={overview.isPending && !overview.data} />
          <PackagesDonut data={categories.data} loading={categories.isPending && !categories.data} />
        </div>
        <RecentClients clients={recent.data} loading={recent.isPending && !recent.data} />
        <div className="grid min-w-0 gap-4 lg:grid-cols-2 lg:gap-5 xl:hidden">
          <AssignedAgents items={agents.data} loading={agents.isPending && !agents.data} />
          <DestinationsCard items={destinations.data} loading={destinations.isPending && !destinations.data} />
        </div>
      </div>
      <div className="hidden space-y-4 xl:block xl:space-y-5">
        <UpcomingBookings items={upcoming.data} loading={upcoming.isPending && !upcoming.data} />
        <AssignedAgents items={agents.data} loading={agents.isPending && !agents.data} />
        <DestinationsCard items={destinations.data} loading={destinations.isPending && !destinations.data} />
        <QuickActions />
      </div>
      <div className="space-y-4 xl:hidden">
        <UpcomingBookings items={upcoming.data} loading={upcoming.isPending && !upcoming.data} />
        <QuickActions />
      </div>
    </div>
  );
}
