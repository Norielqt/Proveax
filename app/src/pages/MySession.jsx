import { useEffect, useState } from 'react';
import { useWorkSessionContext } from '../context/WorkSessionContext';

/* ─────────────────────────────────────────────────────────────────────────
 *  My Session — "Focus Chamber"
 *  A single-card, ring-centric layout. Circular progress ring wraps a large
 *  timer; state-driven gradient + soft mesh background give it depth.
 *  No idle chip — focus is on time worked & next action.
 * ────────────────────────────────────────────────────────────────────────*/

const TONES = {
  fresh:  { ring: ['#93c5fd', '#3b82f6'], halo: 'from-blue-100/60 via-white to-sky-100/40',   pill: 'bg-blue-50 text-blue-700 ring-blue-200' },
  active: { ring: ['#60a5fa', '#2563eb'], halo: 'from-blue-100/70 via-white to-indigo-100/60', pill: 'bg-blue-50 text-blue-700 ring-blue-200' },
  paused: { ring: ['#a5b4fc', '#6366f1'], halo: 'from-indigo-100/60 via-white to-blue-100/40', pill: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
  done:   { ring: ['#bfdbfe', '#3b82f6'], halo: 'from-blue-50/70 via-white to-slate-100/50',   pill: 'bg-blue-50 text-blue-600 ring-blue-200' },
};

const pad = (n) => String(n).padStart(2, '0');
const fmtClock = (secs) => {
  const s = Math.max(0, Math.floor(secs));
  return { h: pad(Math.floor(s / 3600)), m: pad(Math.floor((s % 3600) / 60)), s: pad(s % 60) };
};
const fmtHours = (secs) => {
  const h = Math.max(0, secs) / 3600;
  return h >= 10 ? h.toFixed(1) : h.toFixed(2);
};

export default function MySession() {
  const {
    session, settings, loading, starting, ending, error, dayEnded,
    totalTodaySeconds, needsShareResume, start, end, resumeShare,
  } = useWorkSessionContext();

  const [confirmEnd, setConfirmEnd] = useState(false);
  const [withScreenshots, setWithScreenshots] = useState(true);

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  if (loading) return <PageShell><Skeleton /></PageShell>;

  const active     = !!session && !session.ended_at;
  const hasPrior   = totalTodaySeconds > 0;
  const stateKey   = dayEnded ? 'done' : active ? 'active' : hasPrior ? 'paused' : 'fresh';

  return (
    <PageShell>
      <header className="mb-8 text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-gray-400">{today}</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-900">My Session</h1>
      </header>

      {error && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <Chamber stateKey={stateKey} totalTodaySeconds={totalTodaySeconds} />

      <div className="mt-6">
        {dayEnded ? (
          <DoneCard total={totalTodaySeconds} />
        ) : active ? (
          <ActiveCard
            session={session}
            ending={ending}
            needsShareResume={needsShareResume}
            onResumeShare={resumeShare}
            onEnd={() => setConfirmEnd(true)}
          />
        ) : (
          <StartCard
            withScreenshots={withScreenshots}
            setWithScreenshots={setWithScreenshots}
            starting={starting}
            hasPrior={hasPrior}
            onStart={() => start(withScreenshots)}
            screenshotInterval={settings?.screenshot_interval_minutes ?? 10}
          />
        )}
      </div>

      {confirmEnd && (
        <ConfirmEnd
          ending={ending}
          onCancel={() => setConfirmEnd(false)}
          onConfirm={async () => { await end(); setConfirmEnd(false); }}
        />
      )}
    </PageShell>
  );
}

/* ───────────────────────── Chrome / Layout ───────────────────────── */

function PageShell({ children }) {
  return (
    <div className="relative min-h-full overflow-hidden">
      {/* Soft mesh background */}
      <div className="pointer-events-none absolute inset-0 -z-0">
        <div className="absolute -top-32 left-1/2 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-blue-100/50 blur-3xl" />
        <div className="absolute top-40 -left-24 h-[360px] w-[360px] rounded-full bg-indigo-100/50 blur-3xl" />
        <div className="absolute top-72 -right-20 h-[360px] w-[360px] rounded-full bg-sky-100/40 blur-3xl" />
      </div>
      <div className="relative z-10 mx-auto w-full max-w-xl px-6 py-12">
        {children}
      </div>
    </div>
  );
}

/* ───────────────────────── Hero Chamber (ring + timer) ───────────────────────── */

function Chamber({ stateKey, totalTodaySeconds }) {
  const tone = TONES[stateKey];
  const { h, m, s } = fmtClock(totalTodaySeconds);

  // Ring geometry — full ring as a decorative aurora (no progress %)
  const SIZE   = 360;
  const STROKE = 14;
  const R      = (SIZE - STROKE) / 2;
  const gradId = `ring-${stateKey}`;

  const label = {
    fresh:  'Ready to start',
    active: 'Tracking now',
    paused: 'Paused',
    done:   'Day complete',
  }[stateKey];

  const subline = {
    fresh:  'Begin your first session of the day',
    active: 'Your session is running',
    paused: 'Resume when ready',
    done:   'Hours for today are locked in',
  }[stateKey];

  return (
    <div className={`relative overflow-hidden rounded-[32px] border border-white bg-gradient-to-b ${tone.halo} px-6 py-10 shadow-[0_30px_80px_-30px_rgba(15,23,42,0.18)]`}>
      {/* sheen */}
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" />

      <div className="flex flex-col items-center">
        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ring-1 ${tone.pill}`}>
          <Dot stateKey={stateKey} />
          {label}
        </span>

        <div className="relative mt-8" style={{ width: SIZE, height: SIZE, maxWidth: '100%' }}>
          <svg
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            width="100%"
            height="100%"
            className="block"
          >
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%"  stopColor={tone.ring[0]} />
                <stop offset="100%" stopColor={tone.ring[1]} />
              </linearGradient>
            </defs>
            {/* Outer faint track */}
            <circle
              cx={SIZE / 2} cy={SIZE / 2} r={R}
              fill="none"
              stroke="rgba(15, 23, 42, 0.05)"
              strokeWidth={STROKE}
            />
            {/* Aurora gradient ring */}
            <circle
              cx={SIZE / 2} cy={SIZE / 2} r={R}
              fill="none"
              stroke={`url(#${gradId})`}
              strokeWidth={STROKE}
              strokeLinecap="round"
              transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
              style={{ opacity: 0.85 }}
            />
            {/* Subtle inner hairline for depth */}
            <circle
              cx={SIZE / 2} cy={SIZE / 2} r={R - STROKE / 2 - 6}
              fill="none"
              stroke="rgba(15, 23, 42, 0.04)"
              strokeWidth={1}
            />
          </svg>

          {/* Timer in the center */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="font-mono font-bold tabular-nums leading-none text-gray-900" style={{ letterSpacing: '-0.05em' }}>
              <span className="text-[54px] md:text-[68px]">{h}</span>
              <span className="text-[54px] md:text-[68px] text-gray-300 mx-0.5">:</span>
              <span className="text-[54px] md:text-[68px]">{m}</span>
              <span className="text-[28px] md:text-[36px] align-baseline ml-1 text-gray-300">:{s}</span>
            </div>
            <div className="mt-3 text-[10px] font-bold uppercase tracking-[0.32em] text-gray-400">
              hours&nbsp;·&nbsp;minutes
            </div>
          </div>
        </div>

        <p className="mt-8 text-sm font-medium text-gray-500">{subline}</p>

        {/* hours numeric */}
        <div className="mt-3 inline-flex items-baseline gap-1.5">
          <span className="text-2xl font-bold tracking-tight text-gray-900">{fmtHours(totalTodaySeconds)}</span>
          <span className="text-sm font-semibold text-gray-400">hours today</span>
        </div>
      </div>
    </div>
  );
}

function Dot({ stateKey }) {
  if (stateKey === 'active') {
    return (
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-blue-500" />
      </span>
    );
  }
  const color =
    stateKey === 'paused' ? 'bg-indigo-500' :
    stateKey === 'done'   ? 'bg-blue-400' :
                            'bg-blue-500';
  return <span className={`inline-block h-1.5 w-1.5 rounded-full ${color}`} />;
}

/* ───────────────────────── State Cards ───────────────────────── */

function StartCard({ withScreenshots, setWithScreenshots, starting, hasPrior, onStart, screenshotInterval }) {
  return (
    <div className="rounded-3xl border border-gray-200/70 bg-white p-5 shadow-sm">
      <label className="flex cursor-pointer items-start gap-4 rounded-2xl bg-gray-50/80 p-4 ring-1 ring-gray-200/60 transition hover:bg-gray-50">
        <input
          type="checkbox"
          checked={withScreenshots}
          onChange={(e) => setWithScreenshots(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-900">Capture screenshots</span>
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-500 ring-1 ring-gray-200">
              every {screenshotInterval}m
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-gray-500">
            Periodic screen captures help verify your session. You can stop anytime from the browser bar.
          </p>
        </div>
      </label>

      <button
        onClick={onStart}
        disabled={starting}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 px-5 py-4 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition hover:shadow-xl hover:shadow-blue-600/40 active:scale-[0.99] disabled:cursor-wait disabled:opacity-60"
      >
        {starting ? (
          <>
            <Spinner /> Starting…
          </>
        ) : (
          <>
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z" />
            </svg>
            {hasPrior ? 'Resume tracking' : 'Begin focus session'}
          </>
        )}
      </button>
    </div>
  );
}

function ActiveCard({ session, ending, needsShareResume, onResumeShare, onEnd }) {
  const screenshots = session?.screenshots_count ?? 0;
  const startedAt   = session?.started_at
    ? new Date(session.started_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
    : '—';

  // Live countdown removed — session auto-pauses immediately on refresh now.
  return (
    <div className="rounded-3xl border border-gray-200/70 bg-white p-5 shadow-sm">
      {needsShareResume && (
        <button
          onClick={onResumeShare}
          className="mb-4 flex w-full items-start gap-3 rounded-2xl border border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 p-4 text-left transition hover:border-amber-400 hover:shadow-sm"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-amber-600 ring-1 ring-amber-200">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-amber-900">Session paused</p>
            <p className="mt-0.5 text-xs leading-relaxed text-amber-700">
              Screen share was lost after the page refresh. Tap to resume sharing and restart tracking.
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-600 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white shadow-sm">
            Resume
          </span>
        </button>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Started" value={startedAt} />
        <Stat label="Screenshots" value={screenshots} />
      </div>

      <button
        onClick={onEnd}
        disabled={ending}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gray-900 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-black active:scale-[0.99] disabled:opacity-60"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
          <rect x="6" y="6" width="12" height="12" rx="2" />
        </svg>
        End session for the day
      </button>
    </div>
  );
}

function DoneCard({ total }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-gray-200/70 bg-white p-6 text-center shadow-sm">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-400 to-blue-600 text-white shadow-lg shadow-blue-600/30">
        <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <p className="mt-4 text-base font-bold text-gray-900">Day wrapped</p>
      <p className="mt-1 text-sm text-gray-500">
        You logged <span className="font-semibold text-gray-900">{fmtHours(total)} hours</span> today. Nice work.
      </p>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl bg-gray-50/80 px-4 py-3 ring-1 ring-gray-200/60">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">{label}</p>
      <p className="mt-1 text-base font-bold tabular-nums text-gray-900">{value}</p>
    </div>
  );
}

/* ───────────────────────── Misc ───────────────────────── */

function ConfirmEnd({ ending, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-[1500] flex items-center justify-center bg-gray-900/50 px-6 backdrop-blur-sm">
      <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 px-6 py-5">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-rose-600">End session</p>
          <h2 className="mt-1 text-lg font-bold tracking-tight text-gray-900">Wrap up for today?</h2>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm leading-relaxed text-gray-600">
            Your hours for today will be locked in. You can&apos;t add more time once you end.
          </p>
          <div className="mt-5 flex gap-3">
            <button
              onClick={onCancel}
              disabled={ending}
              className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={ending}
              className="flex-1 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-black disabled:opacity-60"
            >
              {ending ? 'Ending…' : 'Yes, end day'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse">
      <div className="mx-auto h-3 w-40 rounded-full bg-gray-200" />
      <div className="mx-auto mt-3 h-7 w-48 rounded-full bg-gray-200" />
      <div className="mt-10 h-[460px] rounded-[32px] bg-gray-100" />
      <div className="mt-6 h-32 rounded-3xl bg-gray-100" />
    </div>
  );
}
