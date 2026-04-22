import { useState } from 'react';
import { useWorkSession } from '../hooks/useWorkSession';

const fmt = (secs) => {
  const s = Math.max(0, Math.floor(secs));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

export default function MySession() {
  const {
    session, settings, loading, starting, ending, error, isIdle,
    activeSeconds, idleSeconds, start, end,
  } = useWorkSession();

  const [withScreenshots, setWithScreenshots] = useState(true);

  if (loading) {
    return <div className="mx-auto max-w-3xl p-6 text-sm text-gray-500">Loading…</div>;
  }

  const required = !!settings?.screenshots_required;
  const active = !!session && !session.ended_at;

  const handleStart = async () => {
    try { await start(required || withScreenshots); }
    catch { /* error already shown */ }
  };

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-8">
      <h1 className="text-2xl font-bold text-gray-900">Work session</h1>
      <p className="mt-1 text-sm text-gray-500">Track your work time. Your admin can see this session once it ends.</p>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}

      {!active && (
        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
            <svg className="h-8 w-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <circle cx="12" cy="12" r="9" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2" />
            </svg>
          </div>
          <h2 className="mt-4 text-lg font-semibold text-gray-900">No active session</h2>
          <p className="mt-1 text-sm text-gray-500">Start a session when you begin working.</p>

          <div className="mt-6 inline-flex flex-col items-start gap-3 text-left">
            <label className={`inline-flex items-center gap-2 text-sm ${required ? 'text-gray-400' : 'text-gray-700'}`}>
              <input
                type="checkbox"
                disabled={required}
                checked={required || withScreenshots}
                onChange={(e) => setWithScreenshots(e.target.checked)}
                className="h-4 w-4"
              />
              Share screen for periodic screenshots
              {required && <span className="ml-1 text-xs text-amber-600">(required)</span>}
            </label>
            <p className="text-xs text-gray-400">
              Screenshots are captured every {settings?.screenshot_interval_minutes ?? 10} min.
              Your browser will ask which screen to share.
            </p>
          </div>

          <div className="mt-6">
            <button
              onClick={handleStart}
              disabled={starting}
              className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {starting ? 'Starting…' : 'Start session'}
            </button>
          </div>
        </div>
      )}

      {active && (
        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className={`inline-block h-2 w-2 rounded-full ${isIdle ? 'bg-amber-500' : 'bg-green-500 animate-pulse'}`} />
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  {isIdle ? 'Idle — timer paused' : 'Active'}
                </span>
              </div>
              <p className="mt-3 font-mono text-5xl font-semibold text-gray-900">{fmt(activeSeconds)}</p>
              <p className="mt-1 text-xs text-gray-400">Active time in this session</p>
            </div>

            <button
              onClick={end}
              disabled={ending}
              className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {ending ? 'Ending…' : 'End session'}
            </button>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-4 border-t border-gray-100 pt-6 text-sm">
            <Stat label="Started" value={session.started_at ? new Date(session.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'} />
            <Stat label="Idle time" value={fmt(idleSeconds)} />
            <Stat label="Screenshots" value={session.screenshots_enabled ? `Every ${settings?.screenshot_interval_minutes ?? 10} min` : 'Off'} />
          </div>

          <div className="mt-5 rounded-lg bg-blue-50 p-3 text-xs text-blue-800">
            Keep this tab open while working. If you close it, your session will be auto-ended after a short grace period.
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-gray-400">{label}</div>
      <div className="mt-1 font-medium text-gray-900">{value}</div>
    </div>
  );
}
