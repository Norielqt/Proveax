const PROPERTIES = [
  {
    img: '/landing-property-1.png',
    tag: 'Single family',
    address: '428 Oak Ridge Dr',
    city: 'Austin, TX',
    price: '$1,240,000',
    sqft: '3,240 sqft',
    beds: '4 bd · 3 ba',
  },
  {
    img: '/landing-property-2.png',
    tag: 'Craftsman',
    address: '1820 Linden Ave',
    city: 'Portland, OR',
    price: '$865,000',
    sqft: '2,610 sqft',
    beds: '3 bd · 2 ba',
  },
  {
    img: '/landing-property-3.png',
    tag: 'Condo',
    address: '88 Harbor View Pl',
    city: 'Miami, FL',
    price: '$2,050,000',
    sqft: '1,980 sqft',
    beds: '2 bd · 2.5 ba',
  },
];

import { useReveal } from '../../hooks/useReveal';

export default function Showcase() {
  const [headRef, headVisible] = useReveal();
  return (
    <section className="relative border-t border-black/[0.06] bg-white px-6 py-28 md:px-10">
      <div className="mx-auto max-w-7xl">
        <div ref={headRef} className={`mb-16 flex flex-col items-start justify-between gap-6 transition-all duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] md:flex-row md:items-end ${headVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <div>
            <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-[#888]">
              · Live data
            </p>
            <h2 className="font-display text-[32px] font-normal leading-[1] tracking-[-1px] text-[#111] md:text-[44px] lg:text-[60px]">
              The full picture, on
              <br />
              every property.
            </h2>
          </div>
          <p className="max-w-[380px] text-[15px] leading-[1.65] text-[#5a5a55]">
            From single family homes to high-rise condos, Proveax surfaces a
            verified profile the moment you search.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {PROPERTIES.map((p, i) => {
            const [cardRef, cardVisible] = useReveal(0.1);
            return (
            <article
              ref={cardRef}
              key={p.address}
              className={`group relative overflow-hidden rounded-3xl border border-black/[0.06] bg-white transition-all duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-black/20 hover:shadow-[0_24px_60px_-25px_rgba(17,17,17,0.25)] ${cardVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ transitionDelay: `${i * 120}ms` }}
            >
              <div className="relative aspect-[4/5] overflow-hidden bg-[#f4f1eb]">
                <img
                  src={p.img}
                  alt={p.address}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
                <div className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.08em] text-[#111] shadow-sm backdrop-blur">
                  {p.tag}
                </div>
                <div className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-[#111]/85 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.08em] text-white backdrop-blur">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                  Verified
                </div>
              </div>

              <div className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-display text-[22px] leading-tight tracking-[-0.3px] text-[#111]">
                      {p.address}
                    </h3>
                    <div className="mt-1 text-[12px] text-[#888]">{p.city}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-[20px] leading-none tracking-[-0.3px] text-[#111]">
                      {p.price}
                    </div>
                    <div className="mt-1 text-[10px] uppercase tracking-[0.1em] text-[#a0a09a]">
                      Est. value
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex items-center gap-4 border-t border-black/[0.06] pt-4 text-[12px] text-[#5a5a55]">
                  <span>{p.beds}</span>
                  <span className="h-1 w-1 rounded-full bg-[#ccc]"></span>
                  <span>{p.sqft}</span>
                  <span className="ml-auto inline-flex items-center gap-1 font-medium text-[#111] transition-transform group-hover:translate-x-0.5">
                    View
                    <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 8h10M9 4l4 4-4 4" />
                    </svg>
                  </span>
                </div>
              </div>
            </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
