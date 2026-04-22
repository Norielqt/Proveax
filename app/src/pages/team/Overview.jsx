import { useEffect, useState } from 'react';
import { getTeamOverview } from '../../api/reports';

function fmtHours(seconds) {
  return (Number(seconds) / 3600).toFixed(1);
}

function liveAgo(ts) {
  const diff = Math.round((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export default function Overview() {
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => getTeamOverview().then((d) => { if (!cancelled) setData(d); });
    load();
    const id = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  if (!data) return <div className="p-6 text-sm text-gray-500">Loading…</div>;

  const { members, live, today_active_seconds, series, top_users } = data;
  const maxActive = Math.max(1, ...series.map((s) => Number(s.active)));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Overview</h1>
        <p className="text-sm text-gray-500">Live activity and 14-day rollups.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total members" value={members.total} />
        <StatCard label="Paused" value={members.paused} />
        <StatCard label="Live sessions" value={live.length} tone={live.length > 0 ? 'live' : 'ok'} />
        <StatCard label="Today (hrs)" value={fmtHours(today_active_seconds)} />
      </div>

      <div className="rounded-md border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-700">Active hours — last 14 days</h3>
        {series.length === 0 ? (
          <p className="text-sm text-gray-500">No aggregated data yet. Run <code className="rounded bg-gray-100 px-1">php artisan team:aggregate-daily</code> to backfill.</p>
        ) : (
          <div className="flex h-40 items-end gap-1">
            {series.map((s) => {
              const pct = (Number(s.active) / maxActive) * 100;
              return (
                <div key={s.day} className="group flex flex-1 flex-col items-center">
                  <div className="relative w-full rounded-t bg-emerald-500" style={{ height: `${pct}%` }}>
                    <div className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-0.5 text-xs text-white group-hover:block">
                      {fmtHours(s.active)} h — {s.day}
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
          <div className="border-b border-gray-100 px-4 py-2 text-sm font-semibold text-gray-700">Live now</div>
          <ul className="divide-y divide-gray-100 text-sm">
            {live.length === 0 && <li className="px-4 py-4 text-center text-gray-500">Nobody is currently working.</li>}
            {live.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{s.name}</div>
                  <div className="text-xs text-gray-500">{s.email}</div>
                </div>
                <div className="text-right text-xs text-gray-500">
                  <div>{fmtHours(s.active_seconds)} h</div>
                  <div>heartbeat {s.heartbeat ? liveAgo(s.heartbeat) : '—'}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-md border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-4 py-2 text-sm font-semibold text-gray-700">Top 5 — last 14 days</div>
          <ul className="divide-y divide-gray-100 text-sm">
            {top_users.length === 0 && <li className="px-4 py-4 text-center text-gray-500">No aggregated data.</li>}
            {top_users.map((u) => (
              <li key={u.user_id} className="flex items-center gap-3 px-4 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{u.name}</div>
                  <div className="text-xs text-gray-500">{u.email}</div>
                </div>
                <div className="text-right tabular-nums text-sm text-gray-700">{fmtHours(u.active_seconds)} h</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, tone = 'ok' }) {
  const color =
    tone === 'live' ? 'text-emerald-600' :
    tone === 'warn' ? 'text-amber-700'   : 'text-gray-900';
  return (
    <div className="rounded-md border border-gray-200 bg-white px-4 py-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}
