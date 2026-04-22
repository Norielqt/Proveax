import { NavLink, Outlet } from 'react-router-dom';

const nav =
  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition';
const idle = 'text-gray-600 hover:bg-gray-100 hover:text-gray-900';
const active = 'bg-gray-900 text-white hover:bg-gray-900 hover:text-white';

const Icon = ({ d }) => (
  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);

const items = [
  { to: '/admin/team',              end: true, label: 'Overview',     icon: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z' },
  { to: '/admin/team/members',      label: 'Members',     icon: 'M17 20h5v-2a4 4 0 00-5-3.87M9 20H4v-2a4 4 0 015-3.87m6-4.13a4 4 0 11-8 0 4 4 0 018 0z' },
  { to: '/admin/team/timesheets',   label: 'Timesheets',  icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
  { to: '/admin/team/activity',     label: 'Activity',    icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
  { to: '/admin/team/screenshots',  label: 'Screenshots', icon: 'M4 7h3l2-2h6l2 2h3a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V8a1 1 0 011-1zm8 10a4 4 0 100-8 4 4 0 000 8z' },
  { to: '/admin/team/api-usage',    label: 'API Usage',   icon: 'M3 3v18h18M7 14l3-3 4 4 5-7' },
  { to: '/admin/team/settings',     label: 'Settings',    icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z' },
];

export default function TeamLayout() {
  return (
    <div className="mx-auto flex max-w-7xl gap-6 p-4 md:p-8">
      <aside className="sticky top-20 hidden h-fit w-56 shrink-0 md:block">
        <div className="rounded-xl border border-gray-200 bg-white p-3">
          <p className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
            My Team
          </p>
          <nav className="flex flex-col gap-0.5">
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
        </div>
      </aside>

      {/* Mobile: horizontal scrollable tabs */}
      <div className="md:hidden">
        <div className="mb-3 -mx-4 flex gap-1 overflow-x-auto px-4 pb-2">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium ${
                  isActive ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200'
                }`
              }
            >
              {it.label}
            </NavLink>
          ))}
        </div>
      </div>

      <section className="min-w-0 flex-1">
        <Outlet />
      </section>
    </div>
  );
}
