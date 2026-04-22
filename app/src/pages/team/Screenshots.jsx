import { useEffect, useState } from 'react';
import { listMembers } from '../../api/team';
import { listScreenshots, deleteScreenshot } from '../../api/sessions';
import { ScreenshotGridSkeleton } from '../../components/Skeleton';

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function Screenshots() {
  const [members, setMembers] = useState([]);
  const [userId,  setUserId]  = useState('');
  const [from,    setFrom]    = useState(todayISO());
  const [to,      setTo]      = useState(todayISO());
  const [shots,   setShots]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);

  useEffect(() => { listMembers().then(setMembers).catch(() => {}); }, []);

  const run = async () => {
    setLoading(true);
    try {
      const data = await listScreenshots({
        user_id: userId || undefined,
        from:    from || undefined,
        to:      to   || undefined,
      });
      setShots(data);
    } finally { setLoading(false); }
  };

  useEffect(() => { run(); /* initial load */ /* eslint-disable-next-line */ }, []);

  const remove = async (id) => {
    if (!confirm('Delete this screenshot? This cannot be undone.')) return;
    await deleteScreenshot(id);
    setShots((s) => s.filter((x) => x.id !== id));
    if (preview?.id === id) setPreview(null);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Screenshots</h1>
      <p className="mt-1 text-sm text-gray-500">Screen captures from members' active work sessions.</p>

      <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4">
        <Field label="Member">
          <select
            value={userId} onChange={(e) => setUserId(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          >
            <option value="">All members</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </Field>
        <Field label="From">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm" />
        </Field>
        <Field label="To">
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm" />
        </Field>
        <button onClick={run} disabled={loading}
          className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
          {loading ? (
            <span className="flex items-center gap-1.5">
              <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Loading
            </span>
          ) : 'Apply'}
        </button>
      </div>

      {loading ? (
        <div className="mt-6"><ScreenshotGridSkeleton count={8} /></div>
      ) : shots.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-gray-200 bg-white p-12 text-center text-sm text-gray-500">
          No screenshots in this range.
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {shots.map((s) => (
            <button
              key={s.id}
              onClick={() => setPreview(s)}
              className="group overflow-hidden rounded-lg border border-gray-200 bg-white text-left transition hover:border-gray-300 hover:shadow-sm"
            >
              <div className="aspect-video w-full bg-gray-100">
                <img src={s.url} alt="" loading="lazy" className="h-full w-full object-cover" />
              </div>
              <div className="p-2 text-xs">
                <div className="truncate font-medium text-gray-700">{s.user?.name ?? '—'}</div>
                <div className="text-gray-400">{new Date(s.captured_at).toLocaleString()}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/80 p-4"
          onClick={() => setPreview(null)}
        >
          <div className="max-h-[90vh] max-w-5xl overflow-hidden rounded-lg bg-white" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
              <div>
                <div className="text-sm font-semibold text-gray-900">{preview.user?.name ?? '—'}</div>
                <div className="text-xs text-gray-500">{new Date(preview.captured_at).toLocaleString()}</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => remove(preview.id)}
                  className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50">
                  Delete
                </button>
                <button onClick={() => setPreview(null)}
                  className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50">
                  Close
                </button>
              </div>
            </div>
            <img src={preview.url} alt="" className="max-h-[80vh] w-auto" />
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</span>
      {children}
    </label>
  );
}
