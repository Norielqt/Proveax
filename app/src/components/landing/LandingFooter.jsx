const LINKS = ['Search', 'Pricing', 'About', 'Privacy', 'Terms'];

export default function LandingFooter() {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-[#E8F0FB] bg-white px-10 py-8">
      <div className="text-base font-medium text-[#111]">
        Pro<span className="text-[#185FA5]">veax</span>
      </div>
      <div className="flex flex-wrap gap-6">
        {LINKS.map((l) => (
          <a key={l} href="#" className="text-xs text-[#888] hover:text-[#111]">
            {l}
          </a>
        ))}
      </div>
      <div className="text-xs text-[#bbb]">© 2026 Proveax. All rights reserved.</div>
    </footer>
  );
}
