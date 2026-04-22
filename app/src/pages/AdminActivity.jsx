import { useEffect, useRef, useState } from 'react';
import { getActivityLogs, getActivitySummary } from '../api/activity';
import { listMembers } from '../api/team';
import { StatCardsSkeleton, TableSkeleton } from '../components/Skeleton';

// ── Action colour map ──────────────────────────────────────────────────────
const ACTION_STYLES = {
  'member.role_changed':    'bg-purple-100 text-purple-800',
  'member.paused':          'bg-amber-100  text-amber-800',
  'member.unpaused':        'bg-emerald-100 text-emerald-800',
  'member.removed':         'bg-rose-100   text-rose-800',
  'invite.created':         'bg-blue-100   text-blue-800',
  'invite.resent':          'bg-blue-50    text-blue-700',
  'invite.revoked':         'bg-rose-50    text-rose-700',
  'screenshot.viewed':      'bg-gray-100   text-gray-700',
  'screenshot.deleted':     'bg-rose-100   text-rose-800',
  'timesheet.submitted':    'bg-blue-100   text-blue-800',
  'timesheet.approved':     'bg-emerald-100 text-emerald-800',
  'timesheet.rejected':     'bg-rose-100   text-rose-800',
};
const DEFAULT_STYLE = 'bg-gray-100 text-gray-600';

function ActionBadge({ action }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ACTION_STYLES[action] ?? DEFAULT_STYLE}`}>
      {action}
    </span>
  );
}

function Avatar({ name }) {
  const letter = (name ?? '?')[0].toUpperCase();
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
      {letter}
    </div>
  );
}

function timeAgo(ts) {
  const diff = Math.round((Date.now() - new Date(ts)) / 1000);
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(ts).toLocaleDateString();
}

// ── Mini bar chart ─────────────────────────────────────────────────────────
function DailyMiniChart({ daily }) {
  if (!daily?.length) return null;
  const max = Math.max(1, ...daily.map((d) => Number(d.total)));
  return (
    <div className="flex h-10 items-end gap-px">
      {daily.map((d) => (
        <div
          key={d.day}
          title={`${d.total} on ${d.day}`}
          className="flex-1 rounded-sm bg-blue-400 transition-all"
          style={{ height: `${(Number(d.total) / max) * 100}%`, minHeight: 2 }}
        />
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function AdminActivity() {
  const [logs,    setLogs]    = useState(null);
  const [summary, setSummary] = useState(null);
  const [members, setMembers] = useState([]);
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);

  const [filters, setFilters] = useState({ user_id: '', action: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const prevFilters = useRef(filters);

  // Load members + action list once
  useEffect(() => {
    listMembers().then((r) => setMembers(r ?? [])).catch(() => {});
  }, []);

  // Reload logs whenever filters or page change
  useEffect(() => {
    const changedFilter = prevFilters.current !== filters;
    const p = changedFilter ? 1 : page;
    if (changedFilter) setPage(1);
    prevFilters.current = filters;

    setLoading(true);
    const params = { page: p, per_page: 50 };
    if (filters.user_id) params.user_id = filters.user_id;
    if (filters.action)  params.action  = filters.action;
    if (filters.from)    params.from    = filters.from;
    if (filters.to)      params.to      = filters.to;

    getActivityLogs(params).then((d) => {
      setLogs(d);
      if (d.actions?.length) setActions(d.actions);
    }).finally(() => setLoading(false));
  }, [filters, page]);

  // Summary reloads when user filter changes
  useEffect(() => {
    setSummaryLoading(true);
    const params = {};
    if (filters.user_id) params.user_id = filters.user_id;
    getActivitySummary(params).then(setSummary).finally(() => setSummaryLoading(false));
  }, [filters.user_id]);

  const totalPages = logs ? Math.ceil(logs.total / 50) : 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Activity</h1>
        <p className="mt-1 text-sm text-gray-500">Audit trail of all admin and member actions in your workspace.</p>
      </div>

      {/* Summary strip */}
      {summaryLoading ? (
        <StatCardsSkeleton cols={4} />
      ) : summary && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {Object.entries(summary.last_30_days ?? {}).slice(0, 8).map(([action, total]) => (
              <div key={action} className="rounded-md border border-gray-200 bg-white px-3 py-2">
                <ActionBadge action={action} />
                <p className="mt-1.5 text-2xl font-semibold text-gray-900">{total}</p>
                <p className="text-xs text-gray-400">last 30 days</p>
              </div>
            ))}
          </div>
          <div className="rounded-md border border-gray-200 bg-white px-4 py-3">
            <p className="mb-1.5 text-xs text-gray-400">Daily events — 30 days</p>
            <DailyMiniChart daily={summary.daily} />
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 rounded-md border border-gray-200 bg-white p-3">
        <select value={filters.user_id}
          onChange={(e) => setFilters((f) => ({ ...f, user_id: e.target.value }))}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm">
          <option value="">All members</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>{m.name} ({m.email})</option>
          ))}
        </select>
        <select value={filters.action}
          onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm">
          <option value="">All actions</option>
          {actions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <input type="date" value={filters.from}
          onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
        <input type="date" value={filters.to}
          onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
        {(filters.user_id || filters.action || filters.from || filters.to) && (
          <button onClick={() => setFilters({ user_id: '', action: '', from: '', to: '' })}
            className="rounded-md border border-gray-200 px-2 py-1.5 text-sm text-gray-500 hover:bg-gray-50">
            Clear
          </button>
        )}
      </div>

      {/* Log */}
      {loading ? (
        <TableSkeleton rows={8} cols={4} />
      ) : (
        <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
          <ul className="divide-y divide-gray-100">
            {!logs?.data?.length && (
              <li className="px-4 py-10 text-center text-sm text-gray-500">No activity matches these filters.</li>
            )}
            {logs?.data?.map((log) => (
              <li key={log.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50">
                <Avatar name={log.user?.name} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{log.user?.name ?? 'Deleted user'}</span>
                    <ActionBadge action={log.action} />
                  </div>
                  {log.metadata && Object.keys(log.metadata).length > 0 && (
                    <p className="mt-0.5 text-xs text-gray-500">
                      {Object.entries(log.metadata).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                    </p>
                  )}
                  <p className="mt-0.5 text-xs text-gray-400">{log.user?.email}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-gray-500" title={new Date(log.created_at).toLocaleString()}>
                    {timeAgo(log.created_at)}
                  </p>
                  {log.ip && <p className="text-xs text-gray-400">{log.ip}</p>}
                </div>
              </li>
            ))}
          </ul>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2 text-sm">
              <span className="text-gray-500">
                Page {page} of {totalPages} · {logs.total} events
              </span>
              <div className="flex gap-2">
                <button onClick={() => setPage((p) => p - 1)} disabled={page === 1}
                  className="rounded-md border border-gray-200 px-3 py-1 disabled:opacity-40 hover:bg-gray-50">
                  ← Prev
                </button>
                <button onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}
                  className="rounded-md border border-gray-200 px-3 py-1 disabled:opacity-40 hover:bg-gray-50">
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
