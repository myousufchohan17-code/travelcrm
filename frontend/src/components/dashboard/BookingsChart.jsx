import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { EmptyState, Loader } from "../ui/Common";

const ranges = [
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "3m", label: "Last 3 Months" },
  { value: "year", label: "This Year" },
];

export default function BookingsChart({ data, range, onRange, loading }) {
  return (
    <div className="card min-w-0 overflow-hidden p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-slate-800">Bookings Overview</h3>
          <p className="text-xs text-slate-400">Real bookings grouped by date</p>
        </div>
        <select className="input !w-full !py-1.5 !text-xs sm:!w-auto" value={range} onChange={(e) => onRange(e.target.value)}>
          {ranges.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>
      {loading ? <Loader /> : !data?.length ? (
        <EmptyState title="No bookings yet" hint="Create a booking to see this chart update." />
      ) : (
        <div className="h-[200px] min-w-0 sm:h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#3B82F6" strokeWidth={3} dot={{ r: 3 }} name="Bookings" animationDuration={700} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
