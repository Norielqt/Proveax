import { useEffect, useState } from 'react';
import { getActivityLogs, getActivitySummary } from '../api/activity';

export default function AdminActivity() {
  const [logs, setLogs]     = useState({ data: [], total: 0 });
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getActivityLogs({}), getActivitySummary()])
      .then(([l, s]) => { setLogs(l); setSummary(s.last_30_days); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8">Loading…</div>;

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8">
      <h1 className="text-2xl font-bold text-gray-900">Activity</h1>

      {summary && (
        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="font-semibold text-gray-900 mb-3">Last 30 days</h2>
          <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {Object.entries(summary).map(([action, total]) => (
              <div key={action} className="rounded-lg bg-gray-50 p-3 text-center">
                <dt className="text-xs text-gray-500">{action}</dt>
                <dd className="text-2xl font-bold text-gray-900">{total}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <div className="mt-6">
        <h2 className="font-semibold text-gray-900 mb-3">Recent activity</h2>
        <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white overflow-hidden">
          {logs.data?.map((log) => (
            <li key={log.id} className="flex items-center justify-between p-3 text-sm">
              <div>
                <span className="font-medium text-gray-900">{log.action}</span>
                {log.user && <span className="ml-2 text-gray-500">by {log.user.name}</span>}
              </div>
              <div className="text-xs text-gray-400">{new Date(log.created_at).toLocaleString()}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
