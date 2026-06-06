import { useEffect, useState } from 'react';
import { StatCardsSkeleton, ChartSkeleton, TableSkeleton } from '../../components/Skeleton';
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

  if (!data) return (
    <div className="space-y-6">
      <StatCardsSkeleton cols={4} />
      <ChartSkeleton />
      <div className="grid gap-6 md:grid-cols-2">
        <TableSkeleton rows={4} cols={3} />
        <TableSkeleton rows={4} cols={2} />
      </div>
    </div>
  );

  const { members, live, today_active_seconds, series, top_users } = data;
  const maxActive = Math.max(1, ...series.map((s) => Number(s.active)));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#888]">My Team</p>
        <h1 className="mt-1 font-display text-4xl leading-none tracking-tight text-[#111]">Overview</h1>
        <p className="mt-2 text-sm text-[#5a5a55]">Live activity and 14-day rollups.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total members" value={members.total} />
        <StatCard label="Paused" value={members.paused} />
        <StatCard label="Live sessions" value={live.length} tone={live.length > 0 ? 'live' : 'ok'} />
        <StatCard label="Today (hrs)" value={fmtHours(today_active_seconds)} />
      </div>

      <div className="rounded-2xl border border-black/[0.06] bg-white p-5">
        <p className="mb-4 text-[10px] font-medium uppercase tracking-[0.14em] text-[#888]">Active hours · last 14 days</p>
        {series.length === 0 ? (
          <p className="text-sm text-[#888]">No aggregated data yet. Run <code className="rounded bg-black/[0.04] px-1">php artisan team:aggregate-daily</code> to backfill.</p>
        ) : (
          <div className="flex h-40 items-end gap-1">
            {series.map((s) => {
              const pct = (Number(s.active) / maxActive) * 100;
              return (
                <div key={s.day} className="group flex flex-1 flex-col items-center">
                  <div className="relative w-full rounded-t bg-[#111] transition-opacity group-hover:opacity-90" style={{ height: `${pct}%` }}>
                    <div className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-[#111] px-2 py-0.5 text-xs text-white group-hover:block">
                      {fmtHours(s.active)} h · {s.day}
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
          <div className="flex items-center justify-between border-b border-black/[0.04] px-5 py-3">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#888]">Live now</p>
            {live.length > 0 && <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />{live.length} active</span>}
          </div>
          <ul className="divide-y divide-black/[0.04] text-sm">
            {live.length === 0 && <li className="px-5 py-6 text-center text-[#aaa]">Nobody is currently working.</li>}
            {live.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-5 py-3">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-[#111]">{s.name}</div>
                  <div className="truncate text-xs text-[#888]">{s.email}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold tabular-nums text-[#111]">{fmtHours(s.active_seconds)}h</div>
                  <div className="text-[10px] text-[#aaa]">{s.heartbeat ? liveAgo(s.heartbeat) : '—'}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-black/[0.06] bg-white">
          <div className="border-b border-black/[0.04] px-5 py-3">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#888]">Top performers · last 14 days</p>
          </div>
          <ul className="divide-y divide-black/[0.04] text-sm">
            {top_users.length === 0 && <li className="px-5 py-6 text-center text-[#aaa]">No aggregated data.</li>}
            {top_users.map((u, i) => (
              <li key={u.user_id} className="flex items-center gap-3 px-5 py-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#f5f5f5] text-[11px] font-medium text-[#5a5a55]">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-[#111]">{u.name}</div>
                  <div className="truncate text-xs text-[#888]">{u.email}</div>
                </div>
                <div className="text-right text-sm font-semibold tabular-nums text-[#111]">{fmtHours(u.active_seconds)}h</div>
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
    tone === 'warn' ? 'text-amber-700'   : 'text-[#111]';
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white px-5 py-4">
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#888]">{label}</p>
      <p className={`mt-2 font-display text-3xl leading-none tracking-tight ${color}`}>{value}</p>
    </div>
  );
}
