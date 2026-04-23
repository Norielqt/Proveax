const TESTIMONIALS = [
  {
    initials: 'JM',
    name: 'James Morales',
    role: 'Head of Acquisitions, Veridian',
    quote:
      'Proveax replaced three separate data subscriptions. The ownership records alone saved us hours every week.',
  },
  {
    initials: 'SR',
    name: 'Sofia Ramos',
    role: 'Real estate investor, PropCore',
    quote:
      "Finding property owners used to take hours. With Proveax I get the full picture in under a minute. It's a game changer.",
  },
  {
    initials: 'DL',
    name: 'David Lee',
    role: 'Director of Research, Landset',
    quote:
      'The depth of property data is unmatched. Our analysts use it every single day to research markets and track deals.',
  },
];

export default function Testimonials() {
  return (
    <section className="px-6 py-24 md:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 text-center">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#185FA5]">
            Testimonials
          </p>
          <h2 className="mx-auto max-w-[620px] text-[32px] font-semibold leading-[1.15] tracking-[-0.5px] text-[#111] md:text-[38px]">
            Loved by teams that move fast
          </h2>
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.name}
              className="group relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-[#E8F0FB] bg-white p-7 transition-all duration-300 hover:-translate-y-1 hover:border-[#B5D4F4] hover:shadow-[0_14px_40px_-12px_rgba(24,95,165,0.22)]"
            >
              {/* Top gradient accent */}
              <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#185FA5] via-[#378ADD] to-[#85B7EB] opacity-70" />

              {/* Oversized decorative quote */}
              <div
                className="pointer-events-none absolute -right-2 -top-4 select-none font-serif text-[110px] leading-none text-[#E6F1FB]"
                aria-hidden
              >
                "
              </div>

              <div className="relative">
                <div className="mb-3 text-[13px] tracking-[0.2em] text-[#185FA5]">★★★★★</div>
                <p className="text-[14px] leading-[1.65] text-[#333]">{t.quote}</p>
              </div>

              <div className="relative mt-auto flex items-center gap-3 border-t border-[#F0F4FB] pt-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#E6F1FB] to-[#D5E7F7] text-xs font-semibold text-[#185FA5] ring-1 ring-inset ring-[#B5D4F4]/50">
                  {t.initials}
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-[#111]">{t.name}</div>
                  <div className="text-[11px] text-[#888]">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
