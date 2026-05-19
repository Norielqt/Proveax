import { Link } from 'react-router-dom';
import { useReveal } from '../../hooks/useReveal';

export default function CtaSection() {
  const [ref, visible] = useReveal(0.1);
  return (
    <section className="relative overflow-hidden border-t border-black/[0.06] bg-white px-6 py-24 md:px-10">
      <div ref={ref} className={`relative mx-auto max-w-7xl overflow-hidden rounded-[36px] bg-[#111] px-8 py-20 transition-all duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] md:px-16 md:py-24 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        {/* Decorative orbs */}
        <div
          className="pointer-events-none absolute -left-20 top-10 h-72 w-72 rounded-full opacity-40 blur-3xl"
          style={{ background: 'radial-gradient(circle, #185FA5, transparent 70%)' }}
        />
        <div
          className="pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full opacity-30 blur-3xl"
          style={{ background: 'radial-gradient(circle, #378ADD, transparent 70%)' }}
        />
        {/* Grid */}
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        <div className="relative max-w-2xl">
          <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.18em] text-white/60">
            · Ready when you are
          </p>
          <h2 className="font-display text-[32px] font-normal leading-[1] tracking-[-1px] text-white md:text-[44px] lg:text-[64px]">
            Start searching
            <br />
            properties today.
          </h2>
          <p className="mt-6 max-w-[480px] text-[16px] leading-[1.65] text-white/70">
            Join thousands of real estate professionals who rely on Proveax for
            accurate, up to date property intelligence.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link
              to="/register"
              className="group inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-[14px] font-semibold text-[#111] transition-all hover:bg-[#F7F7F5]"
            >
              Start for free
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 8h10M9 4l4 4-4 4" />
              </svg>
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-7 py-3.5 text-[14px] font-medium text-white transition-all hover:border-white/30"
            >
              Sign in
            </Link>
          </div>

          <p className="mt-6 text-[12px] text-white/50">
            No credit card required · 14 day free trial · Cancel anytime
          </p>
        </div>
      </div>
    </section>
  );
}
