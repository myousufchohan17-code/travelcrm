import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { EmptyState, Loader } from "../ui/Common";

const COLORS = ["#3B82F6", "#22C55E", "#F59E0B", "#8B5CF6", "#94A3B8"];

export default function PackagesDonut({ data, loading }) {
  const items = data?.items || [];
  const total = data?.total || 0;
  return (
    <div className="card min-w-0 overflow-hidden p-4 sm:p-5">
      <h3 className="text-base font-bold text-slate-800">Travel Packages</h3>
      <p className="mb-2 text-xs text-slate-400">Categories currently in your catalog</p>
      {loading ? <Loader /> : !items.length ? (
        <EmptyState title="No travel packages yet" hint="Add a package to populate this chart." />
      ) : (
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <div className="relative h-[180px] w-[180px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={items} dataKey="count" nameKey="category" innerRadius={54} outerRadius={78} paddingAngle={3} animationDuration={700}>
                  {items.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-xl font-extrabold text-slate-800">{total}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Total</p>
            </div>
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            {items.map((item, i) => (
              <div key={item.category} className="flex items-center justify-between text-sm">
                <span className="flex min-w-0 items-center gap-2 text-slate-600">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="truncate">{item.category}</span>
                </span>
                <span className="font-bold text-slate-800">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
