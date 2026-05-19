import { Link } from 'react-router-dom';

export default function Header() {
  return (
    <section className="relative overflow-hidden bg-white">
      {/* faint grid overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.6]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(17,17,17,0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(17,17,17,0.035) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
          maskImage: 'radial-gradient(ellipse 90% 70% at 50% 30%, black 30%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse 90% 70% at 50% 30%, black 30%, transparent 80%)',
        }}
      />

      <div className="relative mx-auto grid max-w-7xl gap-12 px-6 pb-24 pt-20 md:grid-cols-12 md:px-10 md:pb-28 md:pt-24">
        {/* LEFT: copy */}
        <div className="relative md:col-span-7 md:pt-6">
          <h1 className="anim-fade-up font-display text-[56px] font-normal leading-[0.98] tracking-[-1.5px] text-[#111] md:text-[88px]" style={{ animationDelay: '0ms' }}>
            The whole story
            <br />
            behind every address.
          </h1>

          <p className="anim-fade-up mt-7 max-w-[480px] text-[16px] leading-[1.65] text-[#5a5a55]" style={{ animationDelay: '120ms' }}>
            Proveax pulls verified ownership, deeds, tax records, valuations and
            market signals into one quiet, beautiful workspace built for serious
            real estate professionals.
          </p>

          <div className="anim-fade-up mt-9 flex flex-wrap items-center gap-3" style={{ animationDelay: '240ms' }}>
            <Link
              to="/register"
              className="group inline-flex items-center gap-2 rounded-full bg-[#111] px-6 py-3 text-[14px] font-medium text-white transition-all hover:bg-[#2a2a2a]"
            >
              Start searching, free
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 8h10M9 4l4 4-4 4" />
              </svg>
            </Link>
            <a
              href="#how"
              className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-6 py-3 text-[14px] font-medium text-[#111] transition-all hover:border-black/25"
            >
              See how it works
            </a>
          </div>

          <div className="anim-fade-up mt-12 flex flex-wrap items-center gap-x-8 gap-y-3 text-[12px] text-[#7a7a72]" style={{ animationDelay: '360ms' }}>
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-[#111]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 4 6 11l-3-3" />
              </svg>
              7-day free trial
            </div>
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-[#111]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 4 6 11l-3-3" />
              </svg>
              Cancel anytime
            </div>
          </div>
        </div>

        {/* RIGHT: image + floating cards */}
        <div className="anim-fade-in relative md:col-span-5" style={{ animationDelay: '200ms' }}>
          <div className="relative">
            <div className="overflow-hidden rounded-[28px] bg-[#f4f1eb] shadow-[0_30px_80px_-30px_rgba(17,17,17,0.35)] ring-1 ring-black/5">
              <img
                src="/landing-hero.png"
                alt="Modern luxury home"
                className="h-[520px] w-full object-cover md:h-[600px]"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            </div>

            {/* Floating data card, top-left */}
            <div className="anim-fade-up absolute -left-4 top-8 hidden w-[230px] rounded-2xl border border-black/[0.06] bg-white/95 p-4 shadow-[0_18px_50px_-15px_rgba(17,17,17,0.25)] backdrop-blur md:block" style={{ animationDelay: '500ms' }}>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#888]">
                  Property
                </span>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200/60">
                  Verified
                </span>
              </div>
              <div className="font-display text-[20px] leading-tight tracking-[-0.5px] text-[#111]">
                428 Oak Ridge Dr
              </div>
              <div className="mt-0.5 text-[11px] text-[#888]">Austin, TX 78704</div>
              <div className="mt-3 grid grid-cols-3 gap-2 border-t border-black/5 pt-3">
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-[#a8a8a0]">Est.</div>
                  <div className="text-[12px] font-semibold text-[#111]">$1.24M</div>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-[#a8a8a0]">Sqft</div>
                  <div className="text-[12px] font-semibold text-[#111]">3,240</div>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-[#a8a8a0]">Year</div>
                  <div className="text-[12px] font-semibold text-[#111]">2018</div>
                </div>
              </div>
            </div>

            {/* Floating owner card, bottom-right */}
            <div className="anim-fade-up absolute -bottom-6 -right-4 hidden w-[240px] rounded-2xl border border-black/[0.06] bg-white/95 p-4 shadow-[0_18px_50px_-15px_rgba(17,17,17,0.25)] backdrop-blur md:block" style={{ animationDelay: '650ms' }}>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#888]">
                Ownership
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#111] text-[12px] font-semibold text-white">
                  MR
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-[#111]">Morgan Reyes</div>
                  <div className="text-[11px] text-[#888]">Owner since 2021</div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1.5 border-t border-black/5 pt-3 text-[11px] text-[#5a5a55]">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                3 deeds on record
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stat strip */}
      <div className="relative border-t border-black/[0.06]">
        <div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-black/[0.06] px-6 py-8 md:grid-cols-4 md:px-10">
          {[
            { num: '150M+', lbl: 'Property records' },
            { num: '12K+',  lbl: 'Professionals onboard' },
            { num: '98%',   lbl: 'Data accuracy' },
            { num: '4.9 / 5', lbl: 'Average rating' },
          ].map((s, i) => (
            <div key={s.lbl} className="anim-fade-up px-6 first:pl-0 last:pr-0" style={{ animationDelay: `${480 + i * 80}ms` }}>
              <div className="font-display text-[32px] font-normal leading-none tracking-[-0.5px] text-[#111]">
                {s.num}
              </div>
              <div className="mt-2 text-[11px] uppercase tracking-[0.08em] text-[#888]">
                {s.lbl}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
