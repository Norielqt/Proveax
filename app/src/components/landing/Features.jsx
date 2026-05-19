import { useReveal } from '../../hooks/useReveal';
import PublicMap from './PublicMap';

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7.5" />
    <path d="m21 21-4.35-4.35" />
  </svg>
);
const OwnerIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);
const HomeIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9.5 12 2l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />
  </svg>
);
const TrendIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 17l6-6 4 4 8-8" />
    <path d="M14 7h7v7" />
  </svg>
);
const ExportIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
    <path d="M5 21h14" />
  </svg>
);

export default function Features() {
  const [headRef, headVisible] = useReveal();
  const [gridRef, gridVisible] = useReveal(0.06);
  return (
    <section id="features" className="bg-white px-6 py-28 md:px-10">
      <div className="mx-auto max-w-7xl">
        <div ref={headRef} className={`mb-16 flex flex-col items-start justify-between gap-6 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] md:flex-row md:items-end ${headVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <div>
            <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-[#888]">
              · Capabilities
            </p>
            <h2 className="font-display max-w-[640px] text-[44px] font-normal leading-[1] tracking-[-1px] text-[#111] md:text-[60px]">
              Every record. Every signal.
              <br />
              One place.
            </h2>
          </div>
          <p className="max-w-[360px] text-[15px] leading-[1.65] text-[#5a5a55]">
            Built for brokers, investors and researchers who need accurate
            property intelligence without juggling six different tools.
          </p>
        </div>

        {/* Bento grid */}
        <div ref={gridRef} className={`grid auto-rows-[minmax(220px,auto)] grid-cols-1 gap-4 transition-all duration-700 delay-100 ease-[cubic-bezier(0.16,1,0.3,1)] md:grid-cols-6 ${gridVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {/* Large feature: Property search */}
          <div className="group relative overflow-hidden rounded-3xl border border-black/[0.06] bg-[#e8edf2] md:col-span-4 md:row-span-2">
            {/* Live MapTiler background */}
            <div className="pointer-events-none absolute inset-0">
              <PublicMap
                center={[-97.7331, 30.2722]}
                zoom={13}
                pins={[{ id: 1, lat: 30.2672, lng: -97.7431, label: '428 Oak Ridge Dr, Austin TX' }]}
              />
            </div>
            {/* Gradient overlay for legibility */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/90 via-white/75 to-white/40" />

            {/* Content */}
            <div className="relative z-10 p-8">
              <div className="mb-6 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white text-[#111] ring-1 ring-black/[0.06]">
                <SearchIcon />
              </div>
              <h3 className="font-display text-[32px] font-normal leading-[1.05] tracking-[-0.5px] text-[#111]">
                Search any property in seconds.
              </h3>
              <p className="mt-3 max-w-[460px] text-[14px] leading-[1.65] text-[#5a5a55]">
                Address, owner name, parcel number, or city. Proveax returns a full,
                verified profile instantly so you can move on to the next decision.
              </p>

              {/* Mock search bar */}
              <div className="mt-8 max-w-[460px] rounded-2xl border border-black/[0.06] bg-white p-3 shadow-[0_10px_40px_-15px_rgba(17,17,17,0.22)]">
                <div className="flex items-center gap-3 rounded-xl bg-[#F7F7F5] px-3 py-2.5">
                  <SearchIcon />
                  <span className="text-[13px] text-[#5a5a55]">428 Oak Ridge Dr, Austin TX</span>
                  <span className="ml-auto rounded-md bg-[#111] px-2 py-1 text-[10px] font-medium text-white">
                    Enter
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {['Deeds', 'Owner', 'Tax history'].map((t) => (
                    <div key={t} className="rounded-lg bg-[#F7F7F5] px-3 py-2 text-[11px] text-[#5a5a55]">
                      {t}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Ownership records */}
          <div className="group rounded-3xl border border-black/[0.06] bg-white p-7 transition-all hover:border-black/15 md:col-span-2">
            <div className="mb-5 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#F7F7F5] text-[#111] ring-1 ring-black/[0.05]">
              <OwnerIcon />
            </div>
            <h3 className="font-display text-[22px] leading-tight tracking-[-0.3px] text-[#111]">
              Ownership history
            </h3>
            <p className="mt-2 text-[13px] leading-[1.6] text-[#666]">
              Current and prior owners, deed chains, transfers and title context.
            </p>
          </div>

          {/* Property details */}
          <div className="group rounded-3xl border border-black/[0.06] bg-white p-7 transition-all hover:border-black/15 md:col-span-2">
            <div className="mb-5 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#F7F7F5] text-[#111] ring-1 ring-black/[0.05]">
              <HomeIcon />
            </div>
            <h3 className="font-display text-[22px] leading-tight tracking-[-0.3px] text-[#111]">
              Full property profile
            </h3>
            <p className="mt-2 text-[13px] leading-[1.6] text-[#666]">
              Lot, building, year built, assessed value, tax history, all in one card.
            </p>
          </div>

          {/* Market trends */}
          <div className="group rounded-3xl border border-black/[0.06] bg-white p-7 transition-all hover:border-black/15 md:col-span-3">
            <div className="mb-5 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#F7F7F5] text-[#111] ring-1 ring-black/[0.05]">
              <TrendIcon />
            </div>
            <h3 className="font-display text-[22px] leading-tight tracking-[-0.3px] text-[#111]">
              Live market signals
            </h3>
            <p className="mt-2 text-[13px] leading-[1.6] text-[#666]">
              Price history, days on market, and neighborhood activity to stay ahead.
            </p>
            {/* mini chart */}
            <svg viewBox="0 0 240 60" className="mt-5 w-full">
              <defs>
                <linearGradient id="lg" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#111" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#111" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M0 45 L30 40 L60 42 L90 30 L120 32 L150 22 L180 25 L210 12 L240 16 L240 60 L0 60 Z" fill="url(#lg)" />
              <path d="M0 45 L30 40 L60 42 L90 30 L120 32 L150 22 L180 25 L210 12 L240 16" fill="none" stroke="#111" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          {/* Interior image card */}
          <div className="group relative overflow-hidden rounded-3xl border border-black/[0.06] bg-[#f4f1eb] md:col-span-3">
            <img
              src="/landing-interior.png"
              alt="Modern interior"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
            <div className="relative flex h-full min-h-[260px] flex-col justify-end p-7 text-white">
              <div className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.1em] backdrop-blur">
                <ExportIcon />
                Export & sync
              </div>
              <h3 className="font-display text-[26px] leading-tight tracking-[-0.3px]">
                Save lists, push to your CRM, share with one click.
              </h3>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {['CSV', 'PDF', 'API', 'Webhook'].map((t) => (
                  <span key={t} className="rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-[11px] backdrop-blur">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
