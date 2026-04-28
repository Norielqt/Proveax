import { useEffect, useRef, useState } from 'react';
import { getActivityLogs, getActivitySummary } from '../api/activity';
import { listMembers } from '../api/team';
import { StatCardsSkeleton, TableSkeleton } from '../components/Skeleton';

// ── Action label map ───────────────────────────────────────────────────────
const ACTION_LABELS = {
  'admin.registered':                   'Admin Registered',
  'admin.registered.google':            'Admin Registered via Google',
  'user.login':                         'Signed In',
  'user.login.google':                  'Signed In via Google',
  'user.logout':                        'Signed Out',
  'monitoring.consent_given':           'Monitoring Consent Given',
  'member.role_changed':                'Role Changed',
  'member.paused':                      'Member Paused',
  'member.unpaused':                    'Member Unpaused',
  'member.removed':                     'Member Removed',
  'invite.created':                     'Invite Sent',
  'invite.resent':                      'Invite Resent',
  'invite.revoked':                     'Invite Revoked',
  'property.search':                    'Property Search',
  'property.view':                      'Property Viewed',
  'screenshot.viewed':                  'Screenshot Viewed',
  'screenshot.deleted':                 'Screenshot Deleted',
  'screenshot.self_deleted_with_penalty': 'Screenshot Deleted (Penalty)',
  'skip_trace.run':                     'Skip Trace Run',
  'timesheet.submitted':                'Timesheet Submitted',
  'timesheet.approved':                 'Timesheet Approved',
  'timesheet.rejected':                 'Timesheet Rejected',
  'session.started':                    'Session Started',
  'session.auto_closed':                'Session Auto-Closed',
};

const labelFor = (action) =>
  ACTION_LABELS[action] ?? action.split('.').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

function ActionBadge({ action }) {
  return (
    <span className="inline-block rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-600">
      {labelFor(action)}
    </span>
  );
}

function Avatar({ name }) {
  const letter = (name ?? '?')[0].toUpperCase();
  const colors = ['bg-blue-500', 'bg-violet-500', 'bg-rose-500', 'bg-amber-500', 'bg-teal-500', 'bg-indigo-500'];
  const color = colors[(name ?? '?').charCodeAt(0) % colors.length];
  return (
    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${color} text-xs font-bold text-white shadow-sm`}>
      {letter}
    </div>
  );
}

function timeAgo(ts) {
  const diff = Math.round((Date.now() - new Date(ts)) / 1000);
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(ts).toLocaleDateString();
}

function MetaChips({ metadata }) {
  if (!metadata || !Object.keys(metadata).length) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {Object.entries(metadata).map(([k, v]) => (
        <span key={k} className="inline-flex items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500">
          <span className="font-medium text-gray-700">{k.replace(/_/g, ' ')}:</span> {String(v)}
        </span>
      ))}
    </div>
  );
}

// ── Mini bar chart ─────────────────────────────────────────────────────────
function DailyMiniChart({ daily }) {
  if (!daily?.length) return null;
  const max = Math.max(1, ...daily.map((d) => Number(d.total)));
  return (
    <div className="flex h-12 items-end gap-0.5">
      {daily.map((d) => (
        <div key={d.day} className="group relative flex-1">
          <div
            className="w-full rounded-t bg-blue-400 group-hover:bg-blue-500 transition-colors"
            style={{ height: `${Math.max(4, (Number(d.total) / max) * 100)}%` }}
          />
          <div className="pointer-events-none absolute bottom-full left-1/2 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-white group-hover:block">
            {d.total} · {d.day}
          </div>
        </div>
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

  useEffect(() => {
    listMembers().then((r) => setMembers(r ?? [])).catch(() => {});
  }, []);

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

  useEffect(() => {
    setSummaryLoading(true);
    const params = {};
    if (filters.user_id) params.user_id = filters.user_id;
    getActivitySummary(params).then(setSummary).finally(() => setSummaryLoading(false));
  }, [filters.user_id]);

  const totalPages = logs ? Math.ceil(logs.total / 50) : 1;
  const hasFilters = filters.user_id || filters.action || filters.from || filters.to;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Activity</h1>
        <p className="mt-1 text-sm text-gray-500">Audit trail of all admin and member actions in your workspace.</p>
      </div>

      {/* Summary strip */}
      {summaryLoading ? (
        <StatCardsSkeleton cols={4} />
      ) : summary && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {Object.entries(summary.last_30_days ?? {}).slice(0, 8).map(([action, total]) => (
              <div key={action} className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-xs text-gray-500 truncate">{labelFor(action)}</p>
                <p className="mt-1.5 text-2xl font-bold text-gray-900">{total}</p>
                <p className="text-xs text-gray-400">last 30 days</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
            <p className="mb-2 text-xs font-medium text-gray-400 uppercase tracking-wide">Daily events — last 30 days</p>
            <DailyMiniChart daily={summary.daily} />
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <select
          value={filters.user_id}
          onChange={(e) => setFilters((f) => ({ ...f, user_id: e.target.value }))}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All members</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <select
          value={filters.action}
          onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All actions</option>
          {actions.map((a) => <option key={a} value={a}>{labelFor(a)}</option>)}
        </select>
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-400">From</span>
          <input type="date" value={filters.from}
            onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-400">To</span>
          <input type="date" value={filters.to}
            onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        {hasFilters && (
          <button
            onClick={() => setFilters({ user_id: '', action: '', from: '', to: '' })}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
          >
            Clear filters
          </button>
        )}
        {logs && (
          <span className="ml-auto text-xs text-gray-400">{logs.total} event{logs.total !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Log list */}
      {loading ? (
        <TableSkeleton rows={8} cols={4} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <ul className="divide-y divide-gray-100">
            {!logs?.data?.length && (
              <li className="px-6 py-14 text-center">
                <p className="text-sm font-medium text-gray-500">No activity matches these filters.</p>
                {hasFilters && (
                  <button onClick={() => setFilters({ user_id: '', action: '', from: '', to: '' })}
                    className="mt-2 text-sm text-blue-600 hover:underline">
                    Clear filters
                  </button>
                )}
              </li>
            )}
            {logs?.data?.map((log) => (
              <li key={log.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                <Avatar name={log.user?.name} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">{log.user?.name ?? 'Deleted user'}</span>
                    <ActionBadge action={log.action} />
                  </div>
                  <MetaChips metadata={log.metadata} />
                  <p className="mt-0.5 text-xs text-gray-400">{log.user?.email}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs font-medium text-gray-500" title={new Date(log.created_at).toLocaleString()}>
                    {timeAgo(log.created_at)}
                  </p>
                  {log.ip && <p className="mt-0.5 text-[11px] text-gray-400 font-mono">{log.ip}</p>}
                </div>
              </li>
            ))}
          </ul>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-5 py-2.5 text-sm">
              <span className="text-gray-500">Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <button onClick={() => setPage((p) => p - 1)} disabled={page === 1}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-40 transition-colors">
                  ← Prev
                </button>
                <button onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-40 transition-colors">
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
