import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const nav =
  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition';
const idle = 'text-[#5a5a55] hover:bg-black/[0.04] hover:text-[#111]';
const active = 'bg-[#111] text-white hover:bg-[#111] hover:text-white';

const Icon = ({ d }) => (
  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);

const getItems = (base) => [
  { to: `${base}/members`,      label: 'Members',     icon: 'M17 20h5v-2a4 4 0 00-5-3.87M9 20H4v-2a4 4 0 015-3.87m6-4.13a4 4 0 11-8 0 4 4 0 018 0z' },
  { to: `${base}/timesheets`,   label: 'Timesheets',  icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
  { to: `${base}/activity`,     label: 'Activity',    adminOnly: true,  icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
  { to: `${base}/screenshots`,  label: 'Screenshots', icon: 'M4 7h3l2-2h6l2 2h3a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V8a1 1 0 011-1zm8 10a4 4 0 100-8 4 4 0 000 8z' },
  { to: `${base}/settings`,     label: 'Settings',    adminOnly: true,  icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z' },
];

export default function TeamLayout({ base = '/admin/team' }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const items = getItems(base).filter((it) => !it.adminOnly || isAdmin);

  return (
    <div className="flex min-h-full">

      {/* Classic sidebar — desktop only */}
      <aside className="sticky top-0 hidden h-[calc(100vh-4rem)] w-60 shrink-0 flex-col border-r border-black/[0.06] bg-white md:flex">
        <div className="px-6 py-6">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#888]">Workspace</p>
          <p className="mt-1 font-display text-2xl leading-none tracking-tight text-[#111]">My Team</p>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-4">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              className={({ isActive }) => `${nav} ${isActive ? active : idle}`}
            >
              <Icon d={it.icon} />
              {it.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Right side: mobile tabs + page content */}
      <div className="flex min-w-0 flex-1 flex-col">

        {/* Mobile: horizontal scrollable tabs */}
        <div className="flex gap-1 overflow-x-auto border-b border-black/[0.06] bg-white px-4 py-2 md:hidden">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              className={({ isActive }) =>
                `shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium ${
                  isActive ? 'bg-[#111] text-white' : 'border border-black/[0.06] bg-white text-[#5a5a55]'
                }`
              }
            >
              {it.label}
            </NavLink>
          ))}
        </div>

        {/* Page content */}
        <div className="flex-1 p-4 md:p-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
