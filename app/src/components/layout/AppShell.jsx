import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import WalletDrawer from '../WalletDrawer';
import proviaxxLogo from '../../assets/Proveax_logo.png.png';

function PlanBadge({ tenant, onClose }) {
  const status = tenant?.subscription_status;

  if (status === 'active') {
    return (
      <div className="mt-2 flex items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
          Active plan
        </span>
      </div>
    );
  }

  if (status === 'trialing' && tenant?.trial_ends_at) {
    const msLeft   = new Date(tenant.trial_ends_at) - Date.now();
    const daysLeft = Math.floor(msLeft / (1000 * 60 * 60 * 24));
    const urgent   = daysLeft <= 2;

    return (
      <div className={`mt-2 rounded-lg px-3 py-2 text-xs ${urgent ? 'bg-amber-50 text-amber-900' : 'bg-blue-50 text-blue-900'}`}>
        <p className="font-medium">
          {daysLeft > 0
            ? `Free trial — ${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining.`
            : 'Free trial — expires today.'}
        </p>
        <Link
          to="/billing"
          onClick={onClose}
          className="mt-1 inline-block font-semibold underline"
        >
          Upgrade →
        </Link>
      </div>
    );
  }

  if (status === 'expired') {
    return (
      <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-900">
        <p className="font-medium">Your trial has expired.</p>
        <Link to="/billing" onClick={onClose} className="mt-1 inline-block font-semibold underline">
          Upgrade →
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

  const nav    = 'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium w-full text-left';
  const active = 'bg-blue-50 text-blue-700';
  const idle   = 'text-gray-700 hover:bg-gray-100';

  function go(path) {
    setOpen(false);
    navigate(path);
  }

  return (
    <div className="relative" ref={ref}>
      {/* Avatar button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" clipRule="evenodd" d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-6.5 8c0-3.59 2.91-6.5 6.5-6.5s6.5 2.91 6.5 6.5H5.5Z" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 z-[1200] mt-2 w-80 rounded-xl border border-gray-200 bg-white shadow-xl ring-1 ring-black/5">

          {/* Identity */}
          <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-sm font-bold">
              {user?.name?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-gray-900">{user?.name}</p>
              <p className="truncate text-xs text-gray-500">{user?.email}</p>
              <p className="truncate text-xs text-gray-400">{tenant?.name}</p>
            </div>
          </div>

          {/* Plan badge — only render section if there's something to show */}
          {(['active','trialing','expired'].includes(tenant?.subscription_status)) && (
            <div className="border-b border-gray-100 px-4 py-2">
              <PlanBadge tenant={tenant} onClose={() => setOpen(false)} />
            </div>
          )}

          {/* Main nav */}
          <div className="p-2 space-y-0.5">
            <p className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Workspace</p>
            <button onClick={() => go('/search')} className={`${nav} ${idle}`}>
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0h6" />
              </svg>
              Properties
            </button>
            <button onClick={() => go('/crm')} className={`${nav} ${idle}`}>
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
              CRM
            </button>
            <button onClick={() => go('/me/session')} className={`${nav} ${idle}`}>
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <circle cx="12" cy="12" r="9" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2" />
              </svg>
              My session
            </button>
            <button onClick={() => go('/billing')} className={`${nav} ${idle}`}>
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              Billing
            </button>
          </div>

          {/* Admin section */}
          {isAdmin && (
            <div className="border-t border-gray-100 p-2 space-y-0.5">
              <p className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Admin</p>
              <button onClick={() => go('/admin/team')} className={`${nav} ${idle}`}>
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-5-3.87M9 20H4v-2a4 4 0 015-3.87m6-4.13a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                My Team
              </button>
              <button onClick={() => go('/admin/team/activity')} className={`${nav} ${idle}`}>
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Activity
              </button>
            </div>
          )}

          {/* Log out */}
          <div className="border-t border-gray-100 p-2">
            <button
              onClick={() => { setOpen(false); logout().then(() => navigate('/login')); }}
              className={`${nav} text-red-600 hover:bg-red-50`}
            >
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h5a2 2 0 012 2v1" />
              </svg>
              Log out
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

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="relative z-[1100] flex h-16 items-center justify-between border-b bg-white pr-4">
        <Link to="/search" className="flex items-center gap-2">
          <img src={proviaxxLogo} alt="Proviaxx" className="h-36 w-auto mt-2" />
        </Link>
        <div className="flex items-center gap-3">
          {/* Wallet */}
          <button
            type="button"
            onClick={() => setWalletOpen(true)}
            className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            aria-label="Open wallet"
          >
            <svg className="h-4 w-4 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2v-5m0 0h-4a2 2 0 000 4h4" />
            </svg>
            <span className="text-sm font-semibold text-gray-800">
              ${Number(user?.balance ?? 0).toFixed(2)}
            </span>
          </button>
          <AccountMenu user={user} tenant={tenant} isAdmin={isAdmin} logout={logout} />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>

      <WalletDrawer open={walletOpen} onClose={() => setWalletOpen(false)} />
    </div>
  );
}
