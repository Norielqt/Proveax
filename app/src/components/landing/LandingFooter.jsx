import logo from '../../assets/Proveax_loading.png';

const COLS = [
  {
    title: 'Product',
    links: ['Features', 'How it works', 'Pricing', 'API'],
  },
  {
    title: 'Company',
    links: ['About', 'Customers', 'Careers', 'Contact'],
  },
  {
    title: 'Legal',
    links: ['Privacy', 'Terms', 'Security', 'Cookies'],
  },
];

export default function LandingFooter() {
  return (
    <footer className="border-t border-black/[0.06] bg-white px-6 py-16 md:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-5">
            <img src={logo} alt="Proveax" className="h-8 w-auto" />
            <p className="mt-5 max-w-[320px] text-[14px] leading-[1.65] text-[#5a5a55]">
              Property intelligence for serious real estate professionals.
              Verified data, beautifully organized.
            </p>
          </div>

          {COLS.map((c) => (
            <div key={c.title} className="md:col-span-2">
              <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#888]">
                {c.title}
              </div>
              <ul className="space-y-2.5">
                {c.links.map((l) => (
                  <li key={l}>
                    <a href="#" className="text-[13px] text-[#3a3a38] transition-colors hover:text-[#111]">
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="md:col-span-1" />
        </div>

        <div className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t border-black/[0.06] pt-8">
          <div className="text-[12px] text-[#888]">
            © 2026 Proveax. All rights reserved.
          </div>
          <div className="flex items-center gap-2 text-[12px] text-[#888]">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
            All systems operational
          </div>
        </div>
      </div>
    </footer>
  );
}
