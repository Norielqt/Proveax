import { useEffect, useState } from 'react';
import { listMembers } from '../../api/team';
import { listScreenshots, deleteScreenshot } from '../../api/sessions';
import { ScreenshotGridSkeleton } from '../../components/Skeleton';
import { useAuth } from '../../context/AuthContext';

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function Screenshots() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [members, setMembers] = useState([]);
  const [userId,  setUserId]  = useState('');
  const [date,    setDate]    = useState(todayISO());
  const [shots,   setShots]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (isAdmin) listMembers().then(setMembers).catch(() => {});
  }, [isAdmin]);

  const run = async () => {
    setLoading(true);
    try {
      const data = await listScreenshots({
        user_id: userId || undefined,
        from:    date   || undefined,
        to:      date   || undefined,
      });
      setShots(data);
    } finally { setLoading(false); }
  };

  useEffect(() => { run(); /* initial load */ /* eslint-disable-next-line */ }, []);

  const remove = async (id) => {
    const warning = isAdmin
      ? 'Delete this screenshot? This cannot be undone.'
      : 'Delete this screenshot? You will lose 10 minutes of tracked time. This cannot be undone.';
    if (!confirm(warning)) return;
    try {
      await deleteScreenshot(id);
      setShots((s) => s.filter((x) => x.id !== id));
      if (preview?.id === id) setPreview(null);
    } catch (err) {
      const msg = err.response?.status === 429
        ? (err.response.data?.message || 'Too many deletions. Please try again later.')
        : (err.response?.data?.message || 'Failed to delete screenshot.');
      alert(msg);
    }
  };

  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#888]">My Team</p>
      <h1 className="mt-1 font-display text-4xl leading-none tracking-tight text-[#111]">Screenshots</h1>
      <p className="mt-2 text-sm text-[#5a5a55]">Screen captures from members' active work sessions.</p>

      <div className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl border border-black/[0.06] bg-white p-4">
        {isAdmin && (
          <Field label="Member">
            <select
              value={userId} onChange={(e) => setUserId(e.target.value)}
              className="rounded-xl border border-black/[0.09] bg-white px-3 py-1.5 text-sm"
            >
              <option value="">All members</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </Field>
        )}
        <Field label="Date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="rounded-xl border border-black/[0.09] bg-white px-3 py-1.5 text-sm" />
        </Field>
        <button onClick={run} disabled={loading}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#111] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#2a2a2a] disabled:opacity-50">
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
        <div className="mt-6 rounded-lg border border-dashed border-black/[0.06] bg-white p-12 text-center text-sm text-[#888]">
          No screenshots in this range.
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {shots.map((s) => (
            <button
              key={s.id}
              onClick={() => setPreview(s)}
              className="group overflow-hidden rounded-2xl border border-black/[0.06] bg-white text-left transition hover:border-black/[0.09] hover:shadow-sm"
            >
              <div className="aspect-video w-full bg-black/[0.04]">
                <img src={s.url} alt="" loading="lazy" className="h-full w-full object-cover" />
              </div>
              <div className="p-2 text-xs">
                <div className="truncate font-medium text-[#5a5a55]">{s.user?.name ?? '—'}</div>
                <div className="text-[#aaa]">{new Date(s.captured_at).toLocaleString()}</div>
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
            <div className="flex items-center justify-between border-b border-black/[0.04] px-4 py-2">
              <div>
                <div className="text-sm font-semibold text-[#111]">{preview.user?.name ?? '—'}</div>
                <div className="text-xs text-[#888]">{new Date(preview.captured_at).toLocaleString()}</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => remove(preview.id)}
                  className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50">
                  Delete{!isAdmin && ' (−10 min)'}
                </button>
                <button onClick={() => setPreview(null)}
                  className="rounded-full border border-black/[0.06] px-2.5 py-1 text-xs font-medium text-[#5a5a55] hover:bg-[#fafafa]">
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
      <span className="text-[10px] font-semibold uppercase tracking-wide text-[#888]">{label}</span>
      {children}
    </label>
  );
}
