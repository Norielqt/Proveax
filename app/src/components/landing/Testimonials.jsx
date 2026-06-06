import { useReveal } from '../../hooks/useReveal';

const FEATURED = {
  initials: 'JM',
  name: 'James Morales',
  role: 'Head of Acquisitions, Veridian',
  quote:
    'Proveax replaced three separate data subscriptions. The ownership records alone save us hours every week, and our analysts actually enjoy using it.',
};

const SECONDARY = [
  {
    initials: 'SR',
    name: 'Sofia Ramos',
    role: 'Investor, PropCore',
    quote:
      'Finding property owners used to take hours. With Proveax I get the full picture in under a minute.',
  },
  {
    initials: 'DL',
    name: 'David Lee',
    role: 'Director of Research, Landset',
    quote:
      'The depth of property data is unmatched. Our team uses it every single day to research markets and track deals.',
  },
];

function Stars() {
  return (
    <div className="flex gap-0.5 text-[#111]">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor">
          <path d="M8 1.2l2.06 4.18 4.6.67-3.33 3.25.79 4.59L8 11.74l-4.12 2.17.79-4.59L1.34 6.05l4.6-.67z" />
        </svg>
      ))}
    </div>
  );
}

export default function Testimonials() {
  const [headRef, headVisible] = useReveal();
  const [featRef, featVisible] = useReveal(0.1);
  const [secRef, secVisible] = useReveal(0.1);
  return (
    <section className="border-t border-black/[0.06] bg-white px-6 py-28 md:px-10">
      <div className="mx-auto max-w-7xl">
        <div ref={headRef} className={`mb-16 max-w-[640px] transition-all duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${headVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-[#888]">
            · From the field
          </p>
          <h2 className="font-display text-[32px] font-normal leading-[1] tracking-[-1px] text-[#111] md:text-[44px] lg:text-[60px]">
            Trusted by teams that
            <br />
            move decisively.
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-5">
          {/* Featured */}
          <figure ref={featRef} className={`relative overflow-hidden rounded-3xl bg-[#111] p-10 text-white transition-all duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] md:col-span-3 ${featVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <div
              className="pointer-events-none absolute -right-10 -top-10 h-64 w-64 rounded-full opacity-20 blur-3xl"
              style={{ background: 'radial-gradient(circle, #ffffff, transparent 70%)' }}
            />
            <div className="relative">
              <Stars />
              <blockquote className="font-display mt-6 text-[28px] font-normal leading-[1.25] tracking-[-0.3px] md:text-[34px]">
                &ldquo;{FEATURED.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-8 flex items-center gap-3 border-t border-white/10 pt-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-[13px] font-semibold ring-1 ring-white/15">
                  {FEATURED.initials}
                </div>
                <div>
                  <div className="text-[14px] font-semibold">{FEATURED.name}</div>
                  <div className="text-[12px] text-white/60">{FEATURED.role}</div>
                </div>
              </figcaption>
            </div>
          </figure>

          {/* Secondary */}
          <div ref={secRef} className="grid gap-4 md:col-span-2">
            {SECONDARY.map((t, i) => (
              <figure
                key={t.name}
                className={`group rounded-3xl border border-black/[0.06] bg-[#F7F7F5] p-7 transition-all duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-black/20 hover:bg-white ${secVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                style={{ transitionDelay: `${i * 120}ms` }}
              >
                <Stars />
                <blockquote className="mt-4 text-[14px] leading-[1.65] text-[#333]">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-5 flex items-center gap-3 border-t border-black/[0.06] pt-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[12px] font-semibold text-[#111] ring-1 ring-black/[0.06]">
                    {t.initials}
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold text-[#111]">{t.name}</div>
                    <div className="text-[11px] text-[#888]">{t.role}</div>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
