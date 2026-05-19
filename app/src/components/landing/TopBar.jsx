import { Link } from 'react-router-dom';
import logo from '../../assets/Proveax_loading.png';

const NAV = [
  { label: 'Features',     href: '#features' },
  { label: 'How it works', href: '#how' },
  { label: 'Pricing',      href: '#pricing' },
];

export default function TopBar() {
  return (
    <nav className="sticky top-0 z-50 border-b border-black/[0.06] bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 md:px-10">
        <Link to="/" className="flex items-center gap-2">
          <img src={logo} alt="Proveax" className="h-7 w-auto" />
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {NAV.map((n) => (
            <a
              key={n.label}
              href={n.href}
              className="text-[13px] font-medium text-[#3a3a38] transition-colors hover:text-[#111]"
            >
              {n.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <Link
            to="/login"
            className="rounded-full px-4 py-2 text-[13px] font-medium text-[#3a3a38] transition-colors hover:text-[#111]"
          >
            Sign in
          </Link>
          <Link
            to="/register"
            className="group inline-flex items-center gap-1.5 rounded-full bg-[#111] px-4 py-2 text-[13px] font-medium text-white transition-all hover:bg-[#2a2a2a]"
          >
            Get started
            <svg viewBox="0 0 16 16" className="h-3 w-3 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 8h10M9 4l4 4-4 4" />
            </svg>
          </Link>
        </div>
      </div>
    </nav>
  );
}
