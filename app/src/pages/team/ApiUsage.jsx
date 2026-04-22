import { useEffect, useState } from 'react';
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

  if (loading || !data) {
    return <div className="p-6 text-sm text-gray-500">Loading…</div>;
  }

  const { summary, daily, per_user, recent_errors } = data;
  const maxDaily = Math.max(1, ...daily.map((d) => Number(d.total)));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">API Usage</h1>
          <p className="text-sm text-gray-500">Rentcast API requests logged by your workspace.</p>
        </div>
        <div className="flex gap-2">
          <input type="date" value={range.from}
            onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
          <input type="date" value={range.to}
            onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total requests" value={summary.total.toLocaleString()} />
        <StatCard label="Billable (API hits)" value={summary.billable.toLocaleString()} />
        <StatCard label="Errors" value={summary.errors.toLocaleString()} tone={summary.errors > 0 ? 'warn' : 'ok'} />
        <StatCard label="Avg latency" value={`${summary.avg_ms} ms`} />
      </div>

      <div className="rounded-md border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-700">Daily volume</h3>
        {daily.length === 0 ? (
          <p className="text-sm text-gray-500">No activity in this range.</p>
        ) : (
          <div className="flex h-40 items-end gap-1">
            {daily.map((d) => {
              const pct = (Number(d.total) / maxDaily) * 100;
              return (
                <div key={d.day} className="group flex flex-1 flex-col items-center">
                  <div className="relative w-full rounded-t bg-blue-500" style={{ height: `${pct}%` }}>
                    <div className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-0.5 text-xs text-white group-hover:block">
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
        <div className="rounded-md border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-4 py-2 text-sm font-semibold text-gray-700">By member</div>
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2 text-left">Member</th>
                <th className="px-4 py-2 text-right">Total</th>
                <th className="px-4 py-2 text-right">Billable</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {per_user.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-4 text-center text-gray-500">No data.</td></tr>
              )}
              {per_user.map((u) => (
                <tr key={u.user_id ?? 'none'}>
                  <td className="px-4 py-2">{u.name}<div className="text-xs text-gray-500">{u.email}</div></td>
                  <td className="px-4 py-2 text-right tabular-nums">{u.total}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{u.billable}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-md border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-4 py-2 text-sm font-semibold text-gray-700">Recent errors</div>
          <ul className="divide-y divide-gray-100 text-sm">
            {recent_errors.length === 0 && (
              <li className="px-4 py-4 text-center text-gray-500">No errors. ✓</li>
            )}
            {recent_errors.map((e) => (
              <li key={e.id} className="px-4 py-2">
                <div className="flex justify-between">
                  <span className="font-mono text-xs">{e.endpoint}</span>
                  <span className="text-xs text-rose-600">HTTP {e.status_code}</span>
                </div>
                <div className="text-xs text-gray-500">{new Date(e.requested_at).toLocaleString()}</div>
                {e.error && <div className="text-xs text-gray-700">{e.error}</div>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, tone = 'ok' }) {
  const color = tone === 'warn' ? 'text-amber-700' : 'text-gray-900';
  return (
    <div className="rounded-md border border-gray-200 bg-white px-4 py-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}
