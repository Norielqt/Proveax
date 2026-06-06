import { useState } from 'react';
import { Link } from 'react-router-dom';
import logo from '../../assets/Proveax_loading.png';

const NAV = [
  { label: 'Features',     href: '#features' },
  { label: 'How it works', href: '#how' },
  { label: 'Pricing',      href: '#pricing' },
];

export default function TopBar() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-black/[0.06] bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 md:px-10">
        <Link to="/" className="flex items-center gap-2">
          <img src={logo} alt="Proveax" className="h-7 w-auto" />
        </Link>

        {/* Desktop nav links */}
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
          {/* Desktop CTAs */}
          <Link
            to="/login"
            className="hidden rounded-full px-4 py-2 text-[13px] font-medium text-[#3a3a38] transition-colors hover:text-[#111] md:inline-flex"
          >
            Sign in
          </Link>
          <Link
            to="/register"
            className="group hidden items-center gap-1.5 rounded-full bg-[#111] px-4 py-2 text-[13px] font-medium text-white transition-all hover:bg-[#2a2a2a] md:inline-flex"
          >
            Get started
            <svg viewBox="0 0 16 16" className="h-3 w-3 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 8h10M9 4l4 4-4 4" />
            </svg>
          </Link>

          {/* Mobile hamburger */}
          <button
            onClick={() => setOpen((v) => !v)}
            className="ml-1 flex h-9 w-9 items-center justify-center rounded-lg text-[#111] transition-colors hover:bg-black/[0.04] md:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
          >
            {open ? (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile overlay menu */}
      {open && (
        <div className="menu-slide-down absolute left-0 right-0 top-full z-50 border-b border-black/[0.06] bg-white px-5 pb-5 shadow-[0_16px_40px_-12px_rgba(17,17,17,0.12)] md:hidden">
          <div className="flex flex-col gap-0.5 pt-2">
            {NAV.map((n) => (
              <a
                key={n.label}
                href={n.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-[14px] font-medium text-[#3a3a38] transition-colors hover:bg-black/[0.04] hover:text-[#111]"
              >
                {n.label}
              </a>
            ))}
          </div>
          <div className="mt-3 flex flex-col gap-2 border-t border-black/[0.06] pt-4">
            <Link
              to="/login"
              onClick={() => setOpen(false)}
              className="w-full rounded-full border border-black/[0.09] py-2.5 text-center text-[14px] font-medium text-[#111] transition-colors hover:bg-black/[0.03]"
            >
              Sign in
            </Link>
            <Link
              to="/register"
              onClick={() => setOpen(false)}
              className="w-full rounded-full bg-[#111] py-2.5 text-center text-[14px] font-medium text-white transition-colors hover:bg-[#2a2a2a]"
            >
              Get started
            </Link>
          </div>
        </div>
      )}
  </nav>
  );
}
