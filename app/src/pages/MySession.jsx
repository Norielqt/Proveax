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
    idleSeconds, totalTodaySeconds, dayEnded, start, end, pause,
  } = useWorkSession();

  const [withScreenshots, setWithScreenshots] = useState(true);
  const [confirmEnd, setConfirmEnd] = useState(false);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl p-4 md:p-8 animate-pulse">
        <div className="h-7 w-36 rounded-md bg-gray-200" />
        <div className="mt-2 h-4 w-72 rounded bg-gray-100" />
        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-8">
          <div className="mx-auto h-16 w-16 rounded-full bg-gray-200" />
          <div className="mx-auto mt-4 h-5 w-40 rounded bg-gray-200" />
          <div className="mx-auto mt-2 h-4 w-56 rounded bg-gray-100" />
          <div className="mt-6 flex items-center gap-3">
            <div className="h-4 w-4 rounded bg-gray-200" />
            <div className="h-4 w-52 rounded bg-gray-200" />
          </div>
          <div className="mt-2 h-3 w-64 rounded bg-gray-100" />
          <div className="mt-6 mx-auto h-10 w-32 rounded-lg bg-gray-200" />
        </div>
      </div>
    );
  }

  const required  = !!settings?.screenshots_required;
  const active    = !!session && !session.ended_at;
  const hasPrior  = totalTodaySeconds > 0 && !active;

  // 8-hour workday goal — tune if you ever expose a per-tenant setting.
  const DAILY_GOAL_SECONDS = 8 * 3600;
  const progress = Math.min(1, totalTodaySeconds / DAILY_GOAL_SECONDS);

  const handleStart = async () => {
    try { await start(required || withScreenshots); }
    catch { /* error already shown */ }
  };

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-8">
      <h1 className="text-2xl font-bold text-gray-900">Work session</h1>
      <p className="mt-1 text-sm text-gray-500">Your total committed time today</p>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
          <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* ── ACTIVE SESSION ── */}
      {active && (
        <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          {/* Accent bar reflects live status */}
          <div className={`h-1 w-full ${isIdle ? 'bg-amber-400' : 'bg-gradient-to-r from-blue-400 to-blue-500'}`} />

          <div className="p-6 md:p-8">
            <div className="flex flex-col-reverse gap-6 md:flex-row md:items-center md:justify-between">
              {/* Hero timer with ring */}
              <div className="flex items-center gap-5">
                <ProgressRing progress={progress} idle={isIdle} />
                <div>
                  <StatusPill idle={isIdle} />
                  <p className="mt-2 font-mono text-5xl font-bold tabular-nums leading-none text-gray-900 md:text-6xl">
                    {fmt(totalTodaySeconds)}
                  </p>
                  <p className="mt-1.5 text-xs text-gray-500">
                    Committed today · goal {Math.round(progress * 100)}%
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 md:flex-col md:gap-2">
                <button
                  onClick={pause}
                  disabled={ending}
                  className="group flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-gray-300 hover:bg-gray-50 disabled:opacity-50 md:flex-none"
                >
                  <svg className="h-4 w-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20"><rect x="5" y="4" width="3" height="12" rx="1"/><rect x="12" y="4" width="3" height="12" rx="1"/></svg>
                  {ending ? '…' : 'Pause'}
                </button>
                <button
                  onClick={() => setConfirmEnd(true)}
                  disabled={ending}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 disabled:opacity-50 md:flex-none"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><rect x="5" y="5" width="10" height="10" rx="1.5"/></svg>
                  {ending ? 'Ending…' : 'End day'}
                </button>
              </div>
            </div>

            {/* Progress bar under hero — reinforces goal metric */}
            <div className="mt-6">
              <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-gray-400">
                <span>Daily progress</span>
                <span>{fmt(totalTodaySeconds)} / {fmt(DAILY_GOAL_SECONDS)}</span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${isIdle ? 'bg-amber-400' : 'bg-blue-500'}`}
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
            </div>

            {/* Stats */}
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatCard
                icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
                label="Session started"
                value={session.started_at ? new Date(session.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
              />
              <StatCard
                icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"/></svg>}
                label="Idle this session"
                value={fmt(idleSeconds)}
              />
              <StatCard
                icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"/></svg>}
                label="Screenshots"
                value={session.screenshots_enabled ? `Every ${settings?.screenshot_interval_minutes ?? 10} min` : 'Off'}
                muted={!session.screenshots_enabled}
              />
            </div>

            {/* Footer hint */}
            <div className="mt-6 flex items-start gap-2 rounded-lg bg-gray-50 px-3 py-2.5 text-xs text-gray-600">
              <svg className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
              </svg>
              <span>Switch tabs freely — tracking continues in the background. If your browser crashes, your time is saved and restored when you return.</span>
            </div>

            {/* Secured badge */}
            <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-gray-400">
              <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
              <span>Encrypted &amp; secured</span>
            </div>
          </div>
        </div>
      )}

      {/* ── NO ACTIVE SESSION ── */}
      {!active && (
        <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className={`h-1 w-full ${dayEnded ? 'bg-blue-600' : hasPrior ? 'bg-blue-500' : 'bg-gray-200'}`} />

          <div className="p-6 md:p-10">
            {dayEnded ? (
              /* ── DAY COMPLETE ── */
              <div className="flex flex-col items-center text-center">
                <div className="flex items-center gap-5">
                  <ProgressRing progress={progress} paused />
                  <div className="text-left">
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5">
                      <svg className="h-3 w-3 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">Day complete</span>
                    </div>
                    <p className="mt-2 font-mono text-5xl font-bold tabular-nums leading-none text-gray-900 md:text-6xl">
                      {fmt(totalTodaySeconds)}
                    </p>
                    <p className="mt-1.5 text-xs text-gray-500">
                      Final committed time today
                    </p>
                  </div>
                </div>
                <div className="mt-6 w-full">
                  <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-gray-400">
                    <span>Daily progress</span>
                    <span>{fmt(totalTodaySeconds)} / {fmt(DAILY_GOAL_SECONDS)}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full rounded-full bg-blue-500 transition-all duration-500" style={{ width: `${progress * 100}%` }} />
                  </div>
                </div>
                <p className="mt-6 text-sm text-gray-500">Your hours have been recorded. See you tomorrow!</p>
              </div>
            ) : hasPrior ? (
              /* ── PAUSED ── */
              <div className="flex flex-col items-center text-center">
                <div className="flex items-center gap-5">
                  <ProgressRing progress={progress} paused />
                  <div className="text-left">
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">Paused</span>
                    </div>
                    <p className="mt-2 font-mono text-5xl font-bold tabular-nums leading-none text-gray-900 md:text-6xl">
                      {fmt(totalTodaySeconds)}
                    </p>
                    <p className="mt-1.5 text-xs text-gray-500">
                      Committed today · goal {Math.round(progress * 100)}%
                    </p>
                  </div>
                </div>

                <div className="mt-6 w-full">
                  <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-gray-400">
                    <span>Daily progress</span>
                    <span>{fmt(totalTodaySeconds)} / {fmt(DAILY_GOAL_SECONDS)}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full rounded-full bg-blue-500 transition-all duration-500" style={{ width: `${progress * 100}%` }} />
                  </div>
                </div>
              </div>
            ) : (
              /* ── FRESH ── */
              <div className="flex flex-col items-center text-center">
                <div className="relative flex h-20 w-20 items-center justify-center">
                  <span className="absolute inset-0 animate-ping rounded-full bg-blue-100 opacity-60" />
                  <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-blue-50 ring-1 ring-blue-100">
                    <svg className="h-9 w-9 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                      <circle cx="12" cy="12" r="9" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2" />
                    </svg>
                  </div>
                </div>
                <h2 className="mt-5 text-lg font-semibold text-gray-900">Ready to start your day</h2>
                <p className="mt-1 max-w-sm text-sm text-gray-500">
                  Click start when you begin working. Your daily total resets at midnight.
                </p>
              </div>
            )}

            {/* Options — hidden once day is ended */}
            {!dayEnded && (
            <div className="mx-auto mt-8 max-w-md">
              <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition ${required ? 'cursor-not-allowed border-gray-200 bg-gray-50' : (withScreenshots ? 'border-blue-200 bg-blue-50/50 ring-1 ring-blue-200' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50')}`}>
                <input
                  type="checkbox"
                  disabled={required}
                  checked={required || withScreenshots}
                  onChange={(e) => setWithScreenshots(e.target.checked)}
                  className="mt-0.5 h-4 w-4 cursor-pointer rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
                />
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${required ? 'text-gray-500' : 'text-gray-900'}`}>
                      Share screen for screenshots
                    </span>
                    {required && (
                      <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
                        Required
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500">
                    Captured every {settings?.screenshot_interval_minutes ?? 10} min. Your browser will prompt you to choose which screen.
                  </p>
                </div>
              </label>

              <button
                onClick={handleStart}
                disabled={starting}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60"
              >
                {starting ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    Starting…
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.84A1 1 0 004.8 3.7v12.6a1 1 0 001.5.86l10.5-6.3a1 1 0 000-1.72L6.3 2.84z"/></svg>
                    {hasPrior ? 'Resume session' : 'Start session'}
                  </>
                )}
              </button>

              {/* Trust badge */}
              <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-gray-400">
                <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                <span>Encrypted &amp; secured</span>
              </div>
            </div>
            )} {/* end !dayEnded options */}
          </div>
        </div>
      )}

      {/* ── END DAY CONFIRMATION MODAL ── */}
      {confirmEnd && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmEnd(false)} />

          <div className="relative w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
            {/* Icon */}
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
              <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>

            <h2 className="mt-4 text-base font-semibold text-gray-900">End your work day?</h2>
            <p className="mt-1.5 text-sm text-gray-500">
              This will mark <span className="font-semibold text-gray-700">{fmt(totalTodaySeconds)}</span> as your final committed time for today. You won't be able to add more hours after this.
            </p>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setConfirmEnd(false)}
                className="flex-1 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => { setConfirmEnd(false); end(); }}
                disabled={ending}
                className="flex-1 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:opacity-50"
              >
                {ending ? 'Ending…' : 'Yes, end day'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusPill({ idle }) {
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 ${idle ? 'bg-amber-50' : 'bg-blue-50'}`}>
      <span className={`relative flex h-1.5 w-1.5`}>
        {!idle && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${idle ? 'bg-amber-500' : 'bg-blue-500'}`} />
      </span>
      <span className={`text-[11px] font-semibold uppercase tracking-wide ${idle ? 'text-amber-700' : 'text-blue-700'}`}>
        {idle ? 'Idle' : 'Tracking'}
      </span>
    </div>
  );
}

function ProgressRing({ progress, idle = false, paused = false }) {
  const size = 84;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(1, Math.max(0, progress)));
  const color = paused ? '#3b82f6' : (idle ? '#fbbf24' : '#3b82f6');

  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90" aria-hidden="true">
      <circle cx={size/2} cy={size/2} r={r} stroke="#f3f4f6" strokeWidth={stroke} fill="none" />
      <circle
        cx={size/2} cy={size/2} r={r}
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={c}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
    </svg>
  );
}

function StatCard({ icon, label, value, muted = false }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/40 p-3">
      <div className={`flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide ${muted ? 'text-gray-400' : 'text-gray-500'}`}>
        <span className="text-gray-400">{icon}</span>
        {label}
      </div>
      <div className={`mt-1 text-sm font-semibold tabular-nums ${muted ? 'text-gray-500' : 'text-gray-900'}`}>{value}</div>
    </div>
  );
}



