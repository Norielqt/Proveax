import { Link } from 'react-router-dom';
import { useReveal } from '../../hooks/useReveal';

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: '99',
    cents: '.99',
    seats: '1-5 users',
    tagline: 'Perfect for small teams and solo agents.',
    pop: false,
    cta: 'Start free trial',
  },
  {
    id: 'team',
    name: 'Team',
    price: '189',
    cents: '.99',
    seats: '6-10 users',
    tagline: 'Best for growing teams that move fast.',
    pop: true,
    cta: 'Start free trial',
  },
  {
    id: 'business',
    name: 'Business',
    price: '249',
    cents: '.99',
    seats: '10+ users',
    tagline: 'Built for large brokerages and enterprises.',
    pop: false,
    cta: 'Start free trial',
  },
];

const INCLUDED = [
  { label: 'Unlimited property search' },
  { label: 'Built-in CRM' },
  { label: 'Team management' },
  { label: 'Lead pipeline' },
  { label: 'Time tracking & timesheets' },
  { label: 'Screenshots & activity' },
  { label: 'Reporting & analytics' },
  { label: 'Email support' },
];

export default function Pricing() {
  const [headRef, headVisible] = useReveal();
  const [cardsRef, cardsVisible] = useReveal(0.06);
  return (
    <section id="pricing" className="border-t border-black/[0.06] bg-[#FAFAF9] py-28">
      <div className="mx-auto max-w-7xl px-6 md:px-10">
        {/* Header */}
        <div ref={headRef} className={`mb-16 flex flex-col items-start justify-between gap-6 transition-all duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] md:flex-row md:items-end ${headVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <div>
            <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-[#888]">. Pricing</p>
            <h2 className="font-display text-[32px] font-normal leading-[1] tracking-[-1px] text-[#111] md:text-[44px] lg:text-[60px]">
              Simple pricing,<br />serious power.
            </h2>
          </div>
          <p className="max-w-[320px] text-right text-[14px] leading-[1.7] text-[#5a5a55]">
            Every plan includes the full platform.<br />
            Pricing scales only with your team size.
          </p>
        </div>
      </div>

      {/* Everything included — full-bleed marquee ticker */}
      <div className="relative mb-10 overflow-hidden border-y border-black/[0.06] bg-white py-4">
        {/* fade edges */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-white to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-white to-transparent" />

        <style>{`
          @keyframes marquee-rtl {
            0%   { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          .marquee-rtl {
            display: flex;
            width: max-content;
            animation: marquee-rtl 22s linear infinite;
          }
          .marquee-rtl:hover { animation-play-state: paused; }
        `}</style>

        <div className="marquee-rtl">
          {[...INCLUDED, ...INCLUDED].map((item, i) => (
            <div key={i} className="flex items-center gap-2 whitespace-nowrap px-6 text-[13px] text-[#444]">
              <svg viewBox="0 0 12 12" className="h-3 w-3 flex-shrink-0 text-[#111]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6.5 4.5 9 10 3.5" /></svg>
              {item.label}
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 md:px-10">
        {/* Plan cards */}
        <div ref={cardsRef} className="grid gap-4 md:grid-cols-3">
          {PLANS.map((plan, i) => {
            const isPop = plan.pop;
            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-3xl p-8 transition-all duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  isPop
                    ? 'bg-[#111] text-white shadow-[0_40px_80px_-20px_rgba(17,17,17,0.45)] md:-translate-y-3'
                    : 'border border-black/[0.07] bg-white hover:shadow-[0_8px_30px_-10px_rgba(0,0,0,0.1)]'
                } ${cardsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                {isPop && (
                  <div className="absolute -top-px left-0 right-0 h-[2px] rounded-t-3xl bg-gradient-to-r from-transparent via-white/60 to-transparent" />
                )}

                <div className="mb-6 flex items-center justify-between">
                  <span className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${isPop ? 'text-white/50' : 'text-[#999]'}`}>
                    {plan.name}
                  </span>
                  {isPop && (
                    <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/80">
                      Popular
                    </span>
                  )}
                </div>

                <div className={`flex items-start ${isPop ? 'text-white' : 'text-[#111]'}`}>
                  <span className={`mt-2.5 mr-0.5 text-[15px] font-medium ${isPop ? 'text-white/60' : 'text-[#999]'}`}>$</span>
                  <span className="font-display text-[64px] font-normal leading-none tracking-[-2px]">{plan.price}</span>
                  <div className="ml-1 mt-auto mb-2">
                    <div className={`text-[15px] font-medium ${isPop ? 'text-white/60' : 'text-[#999]'}`}>{plan.cents}</div>
                    <div className={`text-[11px] ${isPop ? 'text-white/40' : 'text-[#bbb]'}`}>/mo</div>
                  </div>
                </div>

                <div className={`mt-5 inline-flex w-fit items-center gap-2 rounded-xl px-3 py-2 text-[12px] font-semibold ${
                  isPop ? 'bg-white/10 text-white' : 'bg-[#F3F3F1] text-[#333]'
                }`}>
                  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 opacity-70" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.5 4.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM2 14a6 6 0 0 1 12 0" />
                  </svg>
                  {plan.seats}
                </div>

                <p className={`mt-4 mb-8 text-[13px] leading-[1.6] ${isPop ? 'text-white/55' : 'text-[#888]'}`}>
                  {plan.tagline}
                </p>

                <Link
                  to="/register"
                  className={`mt-auto block w-full rounded-full py-3.5 text-center text-[13px] font-semibold tracking-[-0.1px] transition-all ${
                    isPop
                      ? 'bg-white text-[#111] hover:bg-[#F0F0EE]'
                      : 'bg-[#111] text-white hover:bg-[#2a2a2a]'
                  }`}
                >
                  {plan.cta}
                </Link>
                <p className={`mt-3 text-center text-[11px] ${isPop ? 'text-white/30' : 'text-[#bbb]'}`}>
                  7-day trial . Credit card required
                </p>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
