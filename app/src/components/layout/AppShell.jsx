import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import WalletDrawer from '../WalletDrawer';
import proviaxxLogo from '../../assets/Proveax_logo.png.png';

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
        <div className="absolute right-0 z-[1200] mt-2 w-72 rounded-xl border border-gray-200 bg-white shadow-xl ring-1 ring-black/5">

          {/* Identity */}
          <div className="border-b border-gray-100 px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold text-gray-900">{user?.name}</p>
                <p className="mt-0.5 truncate text-xs text-gray-500">{user?.email}</p>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                {user?.name?.[0]?.toUpperCase() ?? '?'}
              </div>
            </div>
          </div>

          {/* Nav */}
          <div className="p-2 space-y-0.5">
            <button onClick={() => go('/search')} className={`${nav} ${idle}`}>
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              Map
            </button>
            <button onClick={() => go('/crm')} className={`${nav} ${idle}`}>
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
              CRM
            </button>
            <button onClick={() => go('/me/session')} className={`${nav} ${idle}`}>
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              My Session
            </button>
            <button onClick={() => go(isAdmin ? '/admin/team' : '/team/members')} className={`${nav} ${idle}`}>
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-5-3.87M9 20H4v-2a4 4 0 015-3.87m6-4.13a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              My Team
            </button>
            <button onClick={() => go('/subscription')} className={`${nav} ${idle}`}>
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              Subscription
            </button>
            <button onClick={() => go(isAdmin ? '/admin/team/settings' : '/subscription')} className={`${nav} ${idle}`}>
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Settings
            </button>
          </div>

          {/* Logout */}
          <div className="border-t border-gray-100 p-2">
            <button
              onClick={() => { setOpen(false); logout().then(() => navigate('/login')); }}
              className={`${nav} text-red-600 hover:bg-red-50`}
            >
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h5a2 2 0 012 2v1" />
              </svg>
              Logout
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

      <main className="flex-1 overflow-y-scroll">
        <Outlet />
      </main>

      <WalletDrawer open={walletOpen} onClose={() => setWalletOpen(false)} />
    </div>
  );
}
