import { Link } from 'react-router-dom';

const STATS = [
  { num: '150M+', lbl: 'Property records' },
  { num: '12K+',  lbl: 'Active users' },
  { num: '98%',   lbl: 'Data accuracy' },
  { num: '4.9★',  lbl: 'Avg rating' },
];

export default function Header() {
  return (
    <section className="relative overflow-hidden">
      {/* Subtle dot grid background */}
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, #B5D4F4 1px, transparent 0)',
          backgroundSize: '28px 28px',
          maskImage:
            'radial-gradient(ellipse 70% 80% at 50% 30%, black 40%, transparent 75%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 70% 80% at 50% 30%, black 40%, transparent 75%)',
        }}
      />
      {/* Soft radial glow */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[600px]"
        style={{
          background:
            'radial-gradient(ellipse 60% 60% at 50% 20%, rgba(24,95,165,0.10), transparent 70%)',
        }}
      />

      <div className="relative mx-auto max-w-5xl px-6 pb-20 pt-24 text-center md:px-10">
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#B5D4F4]/60 bg-white/70 px-4 py-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-[#0C447C] shadow-sm backdrop-blur-sm">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#185FA5] opacity-75"></span>
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#185FA5]"></span>
          </span>
          Property data platform
        </span>

        <h1 className="mx-auto mb-6 max-w-[720px] text-[44px] font-semibold leading-[1.08] tracking-[-1px] text-[#111] md:text-[56px]">
          Find any property.{' '}
          <span className="bg-gradient-to-r from-[#185FA5] via-[#378ADD] to-[#185FA5] bg-clip-text italic text-transparent">
            Know everything about it.
          </span>
        </h1>

        <p className="mx-auto mb-10 max-w-[520px] text-[17px] leading-[1.65] text-[#555]">
          Proveax gives real estate professionals instant access to verified property
          records, ownership data, market trends, and more — all in one place.
        </p>

        <div className="mb-16 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/register"
            className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-[#185FA5] to-[#0C447C] px-7 py-3.5 text-[15px] font-medium text-white shadow-lg shadow-[#185FA5]/25 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[#185FA5]/35"
          >
            Search properties free
            <svg
              viewBox="0 0 20 20"
              fill="none"
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
            >
              <path
                d="M4 10h12M11 5l5 5-5 5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
          <a
            href="#features"
            className="rounded-xl border border-[#B5D4F4] bg-white px-7 py-3.5 text-[15px] font-medium text-[#185FA5] shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[#E6F1FB] hover:shadow"
          >
            See what's inside
          </a>
        </div>

        <div className="mx-auto flex max-w-[640px] overflow-hidden rounded-2xl border border-[#E8F0FB] bg-white/70 shadow-[0_10px_40px_-15px_rgba(24,95,165,0.18)] backdrop-blur-sm">
          {STATS.map((s, i) => (
            <div
              key={i}
              className="flex-1 border-r border-[#E8F0FB] px-4 py-5 last:border-r-0"
            >
              <div className="bg-gradient-to-br from-[#185FA5] to-[#0C447C] bg-clip-text text-[24px] font-semibold leading-none text-transparent">
                {s.num}
              </div>
              <div className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.05em] text-[#888]">
                {s.lbl}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
