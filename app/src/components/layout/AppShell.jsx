import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { WorkSessionProvider, useWorkSessionContext } from '../../context/WorkSessionContext';
import WalletDrawer from '../WalletDrawer';
import proviaxxLogo from '../../assets/Proveax_logo.png.png';

function fmtTimer(secs) {
  const s = Math.max(0, Math.floor(secs));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function SessionTimerPill() {
  const { session, totalTodaySeconds, loading, dayEnded } = useWorkSessionContext();
  if (loading) return null;
  if (dayEnded) return null;

  const isRunning = !!session && !session.ended_at;
  const isPaused  = !isRunning && totalTodaySeconds > 0;
  if (!isRunning && !isPaused) return null;

  const PAUSE_REASONS = {
    auto_paused:   'Screen share stopped',
    share_stopped: 'Screen share stopped',
    stream_black:  'Screen went black',
    idle_timeout:  'Idle timeout',
    paused:        'Manually paused',
    stale:         'Connection lost',
  };
  const pauseReason = isPaused && session?.end_reason
    ? (PAUSE_REASONS[session.end_reason] ?? 'Paused')
    : 'Paused';

  const wrapCls = isRunning
    ? 'border-green-200 bg-green-50 hover:bg-green-100 focus:ring-green-500'
    : 'border-red-200 bg-red-50 hover:bg-red-100 focus:ring-red-500';
  const textCls = isRunning ? 'text-green-700' : 'text-red-700';

  return (
    <Link
      to="/me/session"
      className={`flex items-center gap-2 rounded-full border ${wrapCls} px-3 py-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2`}
      title={isRunning ? 'Go to My Session' : `${pauseReason} — tap to resume`}
    >
      {isRunning ? (
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
        </span>
      ) : (
        <svg className="h-3.5 w-3.5 shrink-0 text-red-500" fill="currentColor" viewBox="0 0 24 24">
          <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
        </svg>
      )}
      <span className={`text-sm font-semibold tabular-nums ${textCls}`}>
        {fmtTimer(totalTodaySeconds)}
      </span>
      {isPaused && (
        <span className="text-[10px] font-bold uppercase tracking-wider text-red-600">{pauseReason}</span>
      )}
    </Link>
  );
}

function PlanBadge({ tenant, onClose }) {
  const status = tenant?.subscription_status;

  if (status === 'active') {
    return (
      <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5">
        <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
        <span className="text-[11px] font-medium text-blue-700">Pro · Active</span>
      </div>
    );
  }

  if (status === 'trialing' && tenant?.trial_ends_at) {
    const daysLeft = Math.floor((new Date(tenant.trial_ends_at) - Date.now()) / 86400000);
    const urgent   = daysLeft <= 2;
    return (
      <div className="mt-2 flex items-center justify-between">
        <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 ${urgent ? 'border-amber-200 bg-amber-50' : 'border-blue-200 bg-blue-50'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${urgent ? 'bg-amber-400' : 'bg-blue-400'}`} />
          <span className={`text-[11px] font-medium ${urgent ? 'text-amber-700' : 'text-blue-700'}`}>
            Free Trial · {daysLeft > 0 ? `${daysLeft}d left` : 'expires today'}
          </span>
        </div>
        <Link to="/subscription" onClick={onClose} className={`text-[11px] font-semibold ${urgent ? 'text-amber-600' : 'text-blue-600'} hover:underline`}>
          Upgrade
        </Link>
      </div>
    );
  }

  if (status === 'expired') {
    return (
      <div className="mt-2 flex items-center justify-between">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
          <span className="text-[11px] font-medium text-red-700">Trial expired</span>
        </div>
        <Link to="/subscription" onClick={onClose} className="text-[11px] font-semibold text-red-600 hover:underline">
          Upgrade
        </Link>
      </div>
    );
  }

  return null;
}

function AccountMenu({ user, tenant, isAdmin, logout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  // Close when clicking outside
  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function go(path) {
    setOpen(false);
    navigate(path);
  }

  const initials = user?.name?.[0]?.toUpperCase() ?? '?';

  const item = 'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-[#333] transition-colors hover:bg-[#f5f5f5]';

  return (
    <div className="relative" ref={ref}>
      {/* Trigger */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-xl px-2 py-1.5 transition-colors hover:bg-[#f5f5f5] focus:outline-none"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
          {initials}
        </div>
        <span className="hidden lg:block max-w-[110px] truncate text-sm font-semibold text-[#111]">
          {user?.name?.split(' ')[0] ?? '—'}
        </span>
        <svg className={`h-3.5 w-3.5 shrink-0 text-[#aaa] transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 z-[1200] mt-2 w-60 overflow-hidden rounded-2xl border border-black/[0.07] bg-white shadow-xl">

          {/* Identity */}
          <div className="px-4 py-4 border-b border-black/[0.06]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[#111] leading-snug">{user?.name ?? '—'}</p>
                <p className="truncate text-xs text-[#999] mt-0.5">{user?.email}</p>
              </div>
            </div>
          </div>

          {/* Tools */}
          <div className="p-2">
            <p className="px-3 pt-1.5 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-[#bbb]">Tools</p>
            <button onClick={() => go('/search')} className={item}>
              <svg className="h-4 w-4 shrink-0 text-[#aaa]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
              Map Search
            </button>
            <button onClick={() => go('/crm')} className={item}>
              <svg className="h-4 w-4 shrink-0 text-[#aaa]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" /></svg>
              Leads
            </button>
          </div>

          <div className="border-t border-black/[0.05]" />

          {/* Work */}
          <div className="p-2">
            <p className="px-3 pt-1.5 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-[#bbb]">Work</p>
            <button onClick={() => go('/me/session')} className={item}>
              <svg className="h-4 w-4 shrink-0 text-[#aaa]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              My Session
            </button>
            <button onClick={() => go(isAdmin ? '/admin/team' : '/team/members')} className={item}>
              <svg className="h-4 w-4 shrink-0 text-[#aaa]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-5-3.87M9 20H4v-2a4 4 0 015-3.87m6-4.13a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              My Team
            </button>
          </div>

          <div className="border-t border-black/[0.05]" />

          {/* Account */}
          <div className="p-2">
            <p className="px-3 pt-1.5 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-[#bbb]">Account</p>
            <button onClick={() => go('/subscription')} className={item}>
              <svg className="h-4 w-4 shrink-0 text-[#aaa]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
              Subscription
            </button>
            <button onClick={() => go('/settings')} className={item}>
              <svg className="h-4 w-4 shrink-0 text-[#aaa]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              Settings
            </button>
          </div>

          {/* Sign out */}
          <div className="border-t border-black/[0.05] p-2">
            <button
              onClick={() => { setOpen(false); logout().then(() => navigate('/login')); }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-red-500 transition-colors hover:bg-red-50/60"
            >
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h5a2 2 0 012 2v1" /></svg>
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AppShell() {
  const { user, tenant, logout } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [walletOpen, setWalletOpen] = useState(false);
  const [welcomeToast, setWelcomeToast] = useState(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Show welcome toast once after login
  useEffect(() => {
    if (sessionStorage.getItem('show_welcome') && user?.name) {
      sessionStorage.removeItem('show_welcome');
      setWelcomeToast(user.name);
      const t = setTimeout(() => setWelcomeToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [user]);

  return (
    <WorkSessionProvider>
    <div className="flex flex-col overflow-hidden" style={{ height: '100dvh' }}>
      <header className="relative z-[1100] flex h-16 items-center justify-between border-b bg-white pr-2 md:pr-4">
        {/* Left: hamburger (mobile) + logo */}
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 md:hidden"
            aria-label="Open menu"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <Link to="/search" className="hidden items-center gap-2 md:flex">
            <img src={proviaxxLogo} alt="Proviaxx" className="h-24 w-auto md:h-36 md:mt-2" />
          </Link>
          <img src={proviaxxLogo} alt="Proviaxx" className="h-24 w-auto md:hidden" />
        </div>

        {/* Right: pills (hidden on mobile) + wallet icon-only on mobile */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* Skip Traces — full pill on desktop, icon-only on mobile */}
          <button
            type="button"
            onClick={() => setWalletOpen(true)}
            className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-2 py-1.5 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 md:px-3"
            aria-label="Open skip traces"
            title="Skip traces remaining"
          >
            <svg className="h-4 w-4 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
            </svg>
            <span className="text-sm font-semibold text-gray-800">
              {Math.floor(Number(user?.balance ?? 0) / 0.20).toLocaleString()}
            </span>
            <span className="hidden text-xs font-medium text-gray-500 sm:inline">skip traces</span>
          </button>
          <div className="hidden md:block"><SessionTimerPill /></div>
          <div className="hidden md:block"><AccountMenu user={user} tenant={tenant} isAdmin={isAdmin} logout={logout} /></div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto min-h-0" style={{ background: '#f9f9f9' }}>
        <Outlet />
      </main>

      <WalletDrawer open={walletOpen} onClose={() => setWalletOpen(false)} />

      {/* Mobile slide-in drawer */}
      <MobileNavDrawer
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        user={user}
        tenant={tenant}
        isAdmin={isAdmin}
        logout={logout}
      />

      {/* Welcome toast */}
      {welcomeToast !== null && (
        <div className="pointer-events-none fixed top-16 right-2 z-[9999] md:right-6">
          <div className="pointer-events-auto flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-xl ring-1 ring-black/[0.07]">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-base">
              👋
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Back again</p>
              <p className="text-sm font-semibold text-[#111] leading-tight">
                {welcomeToast ? `Hey, ${welcomeToast}!` : 'Good to see you!'}
              </p>
            </div>
            <button
              onClick={() => setWelcomeToast(null)}
              className="ml-1 rounded-full p-1 text-[#aaa] hover:text-[#555] hover:bg-[#f4f4f4] transition-colors"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
    </WorkSessionProvider>
  );
}

/**
 * Slide-in drawer shown on mobile (< md). Mirrors all desktop nav + account
 * actions in one place.
 */
function MobileNavDrawer({ open, onClose, user, tenant, isAdmin, logout }) {
  const navigate = useNavigate();
  const go = (path) => { onClose(); navigate(path); };

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // Close on escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const item = 'flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-[15px] font-medium text-gray-800 hover:bg-gray-100';

  return (
    <div className={`fixed inset-0 z-[9998] md:hidden transition-all duration-300 ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}>
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <aside className={`absolute left-0 top-0 flex h-full w-[85%] max-w-sm flex-col overflow-y-auto bg-white shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
              {user?.name?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900">{user?.name ?? '—'}</p>
              <p className="truncate text-[11px] text-gray-500">{user?.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label="Close menu">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Session pill (mobile-friendly) */}
        <div className="border-b border-gray-100 px-4 py-3">
          <SessionTimerPill />
        </div>

        {/* Tools */}
        <div className="p-3">
          <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Tools</p>
          <button onClick={() => go('/search')} className={item}>
            <svg className="h-5 w-5 shrink-0 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            Map
          </button>
          <button onClick={() => go('/crm')} className={item}>
            <svg className="h-5 w-5 shrink-0 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198a6 6 0 01-7.4 0m7.4 0a5.971 5.971 0 00-.94-3.197M12 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
            Leads
          </button>
        </div>

        {/* Work */}
        <div className="border-t border-gray-100 p-3">
          <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Work</p>
          <button onClick={() => go('/me/session')} className={item}>
            <svg className="h-5 w-5 shrink-0 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            My Session
          </button>
          <button onClick={() => go(isAdmin ? '/admin/team' : '/team/members')} className={item}>
            <svg className="h-5 w-5 shrink-0 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-5-3.87M9 20H4v-2a4 4 0 015-3.87m6-4.13a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            My Team
          </button>
        </div>

        {/* Account */}
        <div className="border-t border-gray-100 p-3">
          <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Account</p>
          <button onClick={() => go('/subscription')} className={item}>
            <svg className="h-5 w-5 shrink-0 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            Subscription
          </button>
          <button onClick={() => go('/settings')} className={item}>
            <svg className="h-5 w-5 shrink-0 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </button>
        </div>

        {/* Logout */}
        <div className="mt-auto border-t border-gray-100 p-3">
          <button
            onClick={() => { onClose(); logout().then(() => navigate('/login')); }}
            className={`${item} text-red-600 hover:bg-red-50`}
          >
            <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h5a2 2 0 012 2v1" />
            </svg>
            Logout
          </button>
        </div>
      </aside>
    </div>
  );
}
