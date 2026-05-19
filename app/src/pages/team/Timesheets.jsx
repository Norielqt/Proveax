import { useEffect, useMemo, useState } from 'react';
import { TableSkeleton } from '../../components/Skeleton';
import { useAuth } from '../../context/AuthContext';
import { getDailyLog } from '../../api/reports';
import { listMembers } from '../../api/team';

function fmtHours(seconds) {
  return (seconds / 3600).toFixed(2);
}

export default function Timesheets() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // ── Month navigation ──────────────────────────────────────────────────────
  const [monthOffset, setMonthOffset] = useState(0); // 0 = current month
  const { label, from, to } = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + monthOffset);
    const y = d.getFullYear();
    const m = d.getMonth(); // 0-indexed
    const firstDay = new Date(y, m, 1);
    const lastDay  = new Date(y, m + 1, 0);
    return {
      label: firstDay.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      from:  firstDay.toISOString().slice(0, 10),
      to:    lastDay.toISOString().slice(0, 10),
    };
  }, [monthOffset]);

  // ── Daily log state ───────────────────────────────────────────────────────
  const [dailyRows, setDailyRows] = useState([]);
  const [dailyLoading, setDailyLoading] = useState(true);
  const [memberFilter, setMemberFilter] = useState('');
  const [members, setMembers] = useState([]);

  const reloadDaily = async () => {
    setDailyLoading(true);
    try {
      const params = { from, to };
      if (isAdmin && memberFilter) params.user_id = memberFilter;
      setDailyRows(await getDailyLog(params));
    } finally {
      setDailyLoading(false);
    }
  };

  useEffect(() => { reloadDaily(); }, [from, to, memberFilter]);
  useEffect(() => {
    if (isAdmin) listMembers().then((r) => setMembers(r.members ?? r ?? []));
  }, [isAdmin]);

  const totalMonthSeconds = useMemo(
    () => dailyRows.reduce((sum, r) => sum + Number(r.total_seconds), 0),
    [dailyRows]
  );

  return (
    <div className="space-y-6">
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-[#111] leading-tight">Timesheets</h1>
            <p className="mt-1 text-sm text-[#888]">Daily breakdown of your logged time.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && (
              <select
                value={memberFilter}
                onChange={(e) => setMemberFilter(e.target.value)}
                className="rounded-xl border border-black/[0.09] bg-white px-2 py-1.5 text-sm"
              >
                <option value="">All members</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            )}
            {/* Month navigation */}
            <div className="flex items-center gap-1 rounded-lg border border-black/[0.06] bg-white px-1 py-1">
              <button
                onClick={() => setMonthOffset((o) => o - 1)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-[#888] hover:bg-black/[0.04]"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="min-w-[130px] text-center text-sm font-medium text-[#5a5a55]">{label}</span>
              <button
                onClick={() => setMonthOffset((o) => Math.min(o + 1, 0))}
                disabled={monthOffset === 0}
                className="flex h-7 w-7 items-center justify-center rounded-md text-[#888] hover:bg-black/[0.04] disabled:opacity-30"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Monthly total pill */}
        {!dailyLoading && dailyRows.length > 0 && (
          <div className="mb-3 flex items-center gap-2">
            <span className="text-sm text-[#888]">Total this month:</span>
            <span className="rounded-full bg-black/[0.05] px-3 py-0.5 text-sm font-semibold text-[#5a5a55]">
              {fmtHours(totalMonthSeconds)} hrs
            </span>
          </div>
        )}

        {dailyLoading ? (
          <TableSkeleton rows={6} cols={3} />
        ) : dailyRows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-black/[0.09] bg-white py-12 text-center text-sm text-[#aaa]">
            No sessions logged for {label}.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white">
            <table className="min-w-full divide-y divide-black/[0.04] text-sm">
              <thead className="bg-[#fafafa] text-xs font-semibold uppercase tracking-wide text-[#888]">
                <tr>
                  <th className="px-5 py-3 text-left">Date</th>
                  <th className="px-5 py-3 text-right">Hours Logged</th>
                  <th className="px-5 py-3 text-right">Sessions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04]">
                {dailyRows.map((r) => {
                  const dateLabel = new Date(r.date + 'T00:00:00').toLocaleDateString('en-US', {
                    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
                  });
                  const hrs = fmtHours(r.total_seconds);
                  const pct = Math.min((Number(r.total_seconds) / (8 * 3600)) * 100, 100);
                  return (
                    <tr key={r.date} className="hover:bg-[#fafafa]">
                      <td className="px-5 py-3 font-medium text-[#111]">{dateLabel}</td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-3">
                          {/* Progress bar toward 8h */}
                          <div className="hidden sm:block h-1.5 w-24 overflow-hidden rounded-full bg-black/[0.04]">
                            <div
                              className={`h-full rounded-full ${pct >= 100 ? 'bg-blue-600' : 'bg-blue-600'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="tabular-nums font-semibold text-[#111]">{hrs} hrs</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-[#888]">{r.session_count}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
