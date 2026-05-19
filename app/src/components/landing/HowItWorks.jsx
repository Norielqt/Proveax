const STEPS = [
  {
    n: '01',
    title: 'Create your account',
    desc: 'Sign up in under a minute. No credit card needed to explore.',
  },
  {
    n: '02',
    title: 'Search any address',
    desc: 'Type an address, owner, or city. Proveax returns a complete profile.',
  },
  {
    n: '03',
    title: 'Act on the data',
    desc: 'Save records, build lists, share with your team or export in one click.',
  },
];

import { useReveal } from '../../hooks/useReveal';

export default function HowItWorks() {
  const [leftRef, leftVisible] = useReveal();
  const [stepsRef, stepsVisible] = useReveal(0.08);
  return (
    <section id="how" className="relative overflow-hidden border-t border-black/[0.06] bg-white px-6 py-28 md:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-16 md:grid-cols-12">
          {/* LEFT heading */}
          <div ref={leftRef} className={`transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] md:col-span-5 ${leftVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-[#888]">
              · How it works
            </p>
            <h2 className="font-display text-[44px] font-normal leading-[1] tracking-[-1px] text-[#111] md:text-[60px]">
              From sign up to first
              <br />
              insight, in minutes.
            </h2>
            <p className="mt-6 max-w-[380px] text-[15px] leading-[1.65] text-[#5a5a55]">
              No setup calls. No data imports. Open Proveax, search, and the right
              property record appears already verified.
            </p>

            {/* Aerial image */}
            <div className="mt-10 overflow-hidden rounded-3xl bg-[#f4f1eb] shadow-[0_24px_60px_-25px_rgba(17,17,17,0.3)] ring-1 ring-black/5">
              <img
                src="/landing-aerial.png"
                alt="Aerial view of neighborhood"
                className="h-[260px] w-full object-cover"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            </div>
          </div>

          {/* RIGHT steps */}
          <div ref={stepsRef} className="md:col-span-7 md:pt-4">
            <ol className="relative space-y-3">
              {STEPS.map((s, i) => (
                <li
                  key={s.n}
                  className={`group relative rounded-3xl border border-black/[0.06] bg-white p-7 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-black/20 hover:shadow-[0_18px_50px_-20px_rgba(17,17,17,0.18)] ${stepsVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}`}
                  style={{ transitionDelay: `${i * 120}ms` }}
                >
                  <div className="flex items-start gap-6">
                    <div className="font-display text-[44px] font-normal leading-none tracking-[-1px] text-[#ddd] transition-colors group-hover:text-[#111]">
                      {s.n}
                    </div>
                    <div className="flex-1 pt-1">
                      <h3 className="font-display text-[24px] leading-tight tracking-[-0.3px] text-[#111]">
                        {s.title}
                      </h3>
                      <p className="mt-2 max-w-[440px] text-[14px] leading-[1.65] text-[#5a5a55]">
                        {s.desc}
                      </p>
                    </div>
                    <svg viewBox="0 0 24 24" className="mt-2 h-5 w-5 flex-shrink-0 text-[#ccc] transition-all group-hover:translate-x-1 group-hover:text-[#111]" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
