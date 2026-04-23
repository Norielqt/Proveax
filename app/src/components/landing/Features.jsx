const FEATURES = [
  {
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
    ),
    title: 'Property search',
    desc: 'Search millions of properties by address, owner name, location, or parcel number — instantly.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
    title: 'Ownership records',
    desc: 'See current and historical owners, deed transfers, and title chains with full verification.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
    title: 'Property details',
    desc: 'Lot size, building type, year built, tax records, assessed value — everything in one profile.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
    title: 'Market trends',
    desc: 'Track price history, days on market, and neighborhood activity to stay ahead of the curve.',
  },
];

export default function Features() {
  return (
    <section id="features" className="relative px-6 py-24 md:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 text-center">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#185FA5]">
            What you get
          </p>
          <h2 className="mx-auto mb-4 max-w-[620px] text-[32px] font-semibold leading-[1.15] tracking-[-0.5px] text-[#111] md:text-[38px]">
            All the data you need, right at your fingertips
          </h2>
          <p className="mx-auto max-w-[520px] text-[15px] leading-[1.65] text-[#555]">
            Search any property and instantly surface the information that drives smarter real estate decisions.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group relative overflow-hidden rounded-2xl border border-[#E8F0FB] bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:border-[#B5D4F4] hover:shadow-[0_14px_40px_-12px_rgba(24,95,165,0.22)]"
            >
              {/* Corner accent glow on hover */}
              <div
                className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-60"
                style={{ background: 'radial-gradient(circle, #B5D4F4, transparent 70%)' }}
              />
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#E6F1FB] to-[#D5E7F7] text-[#185FA5] ring-1 ring-inset ring-[#B5D4F4]/50 transition-transform duration-300 group-hover:scale-105 group-hover:bg-gradient-to-br group-hover:from-[#185FA5] group-hover:to-[#0C447C] group-hover:text-white group-hover:ring-transparent">
                {f.icon}
              </div>
              <h3 className="mb-2 text-[15px] font-semibold tracking-[-0.1px] text-[#111]">
                {f.title}
              </h3>
              <p className="text-[13px] leading-[1.6] text-[#666]">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
