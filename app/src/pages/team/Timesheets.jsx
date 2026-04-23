import { useEffect, useState } from 'react';
import { TableSkeleton } from '../../components/Skeleton';
import { useAuth } from '../../context/AuthContext';
import {
  listTimesheets, generateTimesheet, submitTimesheet,
  approveTimesheet, rejectTimesheet, timesheetExportUrl,
} from '../../api/reports';
import { listMembers } from '../../api/team';

function mondayOf(date) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function fmtHours(seconds) {
  return (seconds / 3600).toFixed(2);
}

const STATUS_STYLE = {
  draft:     'bg-gray-100 text-gray-700',
  submitted: 'bg-amber-100 text-amber-800',
  approved:  'bg-blue-100 text-blue-800',
  rejected:  'bg-rose-100 text-rose-800',
};

export default function Timesheets() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [rows, setRows] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', user_id: '' });
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.user_id) params.user_id = filters.user_id;
      setRows(await listTimesheets(params));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, [filters.status, filters.user_id]);
  useEffect(() => {
    if (isAdmin) listMembers().then((r) => setMembers(r.members ?? r ?? []));
  }, [isAdmin]);

  const generate = async (weeksAgo = 0) => {
    setBusy(true);
    try {
      const d = mondayOf(new Date());
      d.setDate(d.getDate() - weeksAgo * 7);
      await generateTimesheet(d.toISOString().slice(0, 10));
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const doSubmit = async (id) => {
    if (!confirm('Submit this timesheet for review? You cannot edit it after.')) return;
    await submitTimesheet(id);
    reload();
  };

  const doReview = async (id, action) => {
    const n = prompt(`Optional note for ${action}:`) ?? '';
    if (action === 'approve') await approveTimesheet(id, n);
    else await rejectTimesheet(id, n);
    reload();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Timesheets</h1>
          <p className="mt-1 text-sm text-gray-500">Weekly rollup of tracked time. Submit for approval.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => generate(0)} disabled={busy}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            Generate this week
          </button>
          <button onClick={() => generate(1)} disabled={busy}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            Generate last week
          </button>
          {isAdmin && (
            <a href={timesheetExportUrl(filters)} target="_blank" rel="noopener"
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Export CSV
            </a>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 rounded-md border border-gray-200 bg-white p-3">
        <select value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm">
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="submitted">Submitted</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        {isAdmin && (
          <select value={filters.user_id}
            onChange={(e) => setFilters((f) => ({ ...f, user_id: e.target.value }))}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm">
            <option value="">All members</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name} ({m.email})</option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <TableSkeleton rows={5} cols={isAdmin ? 7 : 6} />
      ) : (
      <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-2 text-left">Week</th>
              {isAdmin && <th className="px-4 py-2 text-left">Member</th>}
              <th className="px-4 py-2 text-right">Hours</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Submitted</th>
              <th className="px-4 py-2 text-left">Reviewed</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr><td colSpan={isAdmin ? 7 : 6} className="px-4 py-6 text-center text-gray-500">No timesheets yet. Click Generate to create one.</td></tr>
            ) : rows.map((r) => {
              const isOwner = r.user_id === user?.id;
              return (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">{r.week_start} → {r.week_end}</td>
                  {isAdmin && <td className="px-4 py-2">{r.user?.name ?? '—'}</td>}
                  <td className="px-4 py-2 text-right tabular-nums">{fmtHours(r.total_active_seconds)}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[r.status]}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-500">{r.submitted_at ? new Date(r.submitted_at).toLocaleString() : '—'}</td>
                  <td className="px-4 py-2 text-gray-500">{r.reviewed_at ? new Date(r.reviewed_at).toLocaleString() : '—'}</td>
                  <td className="px-4 py-2 text-right">
                    {isOwner && r.status === 'draft' && (
                      <button onClick={() => doSubmit(r.id)} className="text-blue-600 hover:underline">Submit</button>
                    )}
                    {isAdmin && r.status === 'submitted' && !isOwner && (
                      <div className="flex justify-end gap-3">
                        <button onClick={() => doReview(r.id, 'approve')} className="text-blue-600 hover:underline">Approve</button>
                        <button onClick={() => doReview(r.id, 'reject')} className="text-rose-600 hover:underline">Reject</button>
                      </div>
                    )}
                    {r.reviewer_note && (
                      <p className="mt-1 text-xs text-gray-500">Note: {r.reviewer_note}</p>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
