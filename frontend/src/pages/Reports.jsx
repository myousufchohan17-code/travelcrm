import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import api, { money } from "../api/client";
import { EmptyState, Loader } from "../components/ui/Common";

export default function Reports() {
  const report = useQuery({ queryKey: ["reports"], queryFn: async () => (await api.get("/reports")).data });
  if (report.isPending && !report.data) return <div className="card"><Loader /></div>;
  const data = report.data || {};

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-extrabold">Reports</h1>
        <p className="text-xs text-slate-400">All figures are calculated from live MySQL data</p>
      </div>
      <div className="grid min-w-0 gap-5 xl:grid-cols-2">
        <ChartCard title="Revenue reports" empty={!data.revenueMonthly?.length} emptyTitle="No revenue yet">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.revenueMonthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => money(v)} />
              <Line type="monotone" dataKey="revenue" stroke="#2563EB" strokeWidth={3} animationDuration={700} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Client growth" empty={!data.clientGrowth?.length} emptyTitle="No client growth data">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.clientGrowth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#3B82F6" radius={[8, 8, 0, 0]} animationDuration={700} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
      <div className="grid min-w-0 gap-5 lg:grid-cols-3">
        <TableCard title="Booking reports" rows={data.bookingsByStatus} columns={["status", "count", "revenue"]} empty="No bookings yet" />
        <TableCard title="Destination popularity" rows={data.destinationPopularity} columns={["name", "bookings", "revenue"]} empty="No destination data" />
        <TableCard title="Package performance" rows={data.packagePerformance} columns={["name", "bookings", "revenue"]} empty="No package performance yet" />
      </div>
      <TableCard title="Agent performance" rows={data.agentPerformance} columns={["full_name", "bookings", "revenue"]} empty="No agent performance yet" />
    </div>
  );
}

function ChartCard({ title, empty, emptyTitle, children }) {
  return (
    <div className="card min-w-0 overflow-hidden p-4 sm:p-5">
      <h3 className="mb-3 font-bold">{title}</h3>
      {empty ? <EmptyState title={emptyTitle} /> : <div className="h-[200px] min-w-0 sm:h-[240px]">{children}</div>}
    </div>
  );
}

function TableCard({ title, rows, columns, empty }) {
  return (
    <div className="card overflow-hidden">
      <h3 className="px-5 py-4 font-bold">{title}</h3>
      {!rows?.length ? (
        <EmptyState title={empty} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase text-slate-400">
              <tr>{columns.map((c) => <th key={c} className="px-5 py-2">{c.replaceAll("_", " ")}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-t border-slate-50">
                  {columns.map((c) => (
                    <td key={c} className="px-5 py-2 capitalize">
                      {c === "revenue" ? money(row[c]) : row[c] ?? "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
