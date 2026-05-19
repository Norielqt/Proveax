import { useEffect, useState } from 'react';
import { StatCardsSkeleton, ChartSkeleton, TableSkeleton } from '../../components/Skeleton';
import { getApiUsage } from '../../api/reports';

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export default function ApiUsage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState({ from: daysAgo(29), to: daysAgo(0) });

  useEffect(() => {
    setLoading(true);
    getApiUsage(range).then(setData).finally(() => setLoading(false));
  }, [range.from, range.to]);

  if (loading || !data) return (
    <div className="space-y-6">
      <StatCardsSkeleton cols={4} />
      <ChartSkeleton />
      <div className="grid gap-6 md:grid-cols-2">
        <TableSkeleton rows={5} cols={3} />
        <TableSkeleton rows={5} cols={2} />
      </div>
    </div>
  );

  const { summary, daily, per_user, recent_errors } = data;
  const maxDaily = Math.max(1, ...daily.map((d) => Number(d.total)));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#888]">My Team</p>
          <h1 className="mt-1 font-display text-4xl leading-none tracking-tight text-[#111]">API Usage</h1>
          <p className="mt-2 text-sm text-[#5a5a55]">Rentcast API requests logged by your workspace.</p>
        </div>
        <div className="flex gap-2">
          <input type="date" value={range.from}
            onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
            className="rounded-xl border border-black/[0.09] bg-white px-2 py-1.5 text-sm" />
          <input type="date" value={range.to}
            onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
            className="rounded-xl border border-black/[0.09] bg-white px-2 py-1.5 text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total requests" value={summary.total.toLocaleString()} />
        <StatCard label="Billable (API hits)" value={summary.billable.toLocaleString()} />
        <StatCard label="Errors" value={summary.errors.toLocaleString()} tone={summary.errors > 0 ? 'warn' : 'ok'} />
        <StatCard label="Avg latency" value={`${summary.avg_ms} ms`} />
      </div>

      <div className="rounded-2xl border border-black/[0.06] bg-white p-5">
        <p className="mb-4 text-[10px] font-medium uppercase tracking-[0.14em] text-[#888]">Daily volume</p>
        {daily.length === 0 ? (
          <p className="text-sm text-[#888]">No activity in this range.</p>
        ) : (
          <div className="flex h-40 items-end gap-1">
            {daily.map((d) => {
              const pct = (Number(d.total) / maxDaily) * 100;
              return (
                <div key={d.day} className="group flex flex-1 flex-col items-center">
                  <div className="relative w-full rounded-t bg-[#111] transition-opacity group-hover:opacity-90" style={{ height: `${pct}%` }}>
                    <div className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-[#111] px-2 py-0.5 text-xs text-white group-hover:block">
                      {d.total} on {d.day}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-black/[0.06] bg-white">
          <div className="border-b border-black/[0.04] px-5 py-3">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#888]">By member</p>
          </div>
          <table className="min-w-full divide-y divide-black/[0.04] text-sm">
            <thead className="bg-[#f9f9f9] text-[10px] uppercase tracking-[0.14em] text-[#888]">
              <tr>
                <th className="px-5 py-2.5 text-left font-medium">Member</th>
                <th className="px-5 py-2.5 text-right font-medium">Total</th>
                <th className="px-5 py-2.5 text-right font-medium">Billable</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {per_user.length === 0 && (
                <tr><td colSpan={3} className="px-5 py-6 text-center text-[#aaa]">No data.</td></tr>
              )}
              {per_user.map((u) => (
                <tr key={u.user_id ?? 'none'} className="hover:bg-[#f9f9f9]">
                  <td className="px-5 py-3"><div className="text-sm font-medium text-[#111]">{u.name}</div><div className="text-xs text-[#888]">{u.email}</div></td>
                  <td className="px-5 py-3 text-right tabular-nums font-medium text-[#111]">{u.total}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-[#5a5a55]">{u.billable}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-2xl border border-black/[0.06] bg-white">
          <div className="border-b border-black/[0.04] px-5 py-3">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#888]">Recent errors</p>
          </div>
          <ul className="divide-y divide-black/[0.04] text-sm">
            {recent_errors.length === 0 && (
              <li className="px-5 py-6 text-center text-[#aaa]">No errors.</li>
            )}
            {recent_errors.map((e) => (
              <li key={e.id} className="px-5 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate font-mono text-xs text-[#111]">{e.endpoint}</span>
                  <span className="shrink-0 rounded-full border border-rose-200/70 bg-rose-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-rose-700">HTTP {e.status_code}</span>
                </div>
                <div className="mt-0.5 text-[11px] text-[#aaa]">{new Date(e.requested_at).toLocaleString()}</div>
                {e.error && <div className="mt-1 text-xs text-[#5a5a55]">{e.error}</div>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, tone = 'ok' }) {
  const color = tone === 'warn' ? 'text-amber-700' : 'text-[#111]';
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white px-5 py-4">
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#888]">{label}</p>
      <p className={`mt-2 font-display text-3xl leading-none tracking-tight ${color}`}>{value}</p>
    </div>
  );
}
