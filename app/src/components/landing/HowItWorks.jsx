const STEPS = [
  {
    n: '1',
    title: 'Create a free account',
    desc: 'Sign up in seconds. No credit card required to get started.',
  },
  {
    n: '2',
    title: 'Search any property',
    desc: 'Enter an address, owner name, or location and get results immediately.',
  },
  {
    n: '3',
    title: 'Access & export data',
    desc: 'View full property profiles, save records, and export lists for your workflow.',
  },
];

export default function HowItWorks() {
  return (
    <section className="relative overflow-hidden border-b border-t border-[#E8F0FB] bg-gradient-to-b from-[#F7FAFF] to-[#EEF4FC] px-6 py-24 md:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-16 text-center">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#185FA5]">
            How it works
          </p>
          <h2 className="mx-auto mb-4 max-w-[620px] text-[32px] font-semibold leading-[1.15] tracking-[-0.5px] text-[#111] md:text-[38px]">
            Start finding data in seconds
          </h2>
          <p className="mx-auto max-w-[520px] text-[15px] leading-[1.65] text-[#555]">
            No setup. No technical knowledge needed. Just search and get the data you need.
          </p>
        </div>

        <div className="relative grid gap-10 sm:grid-cols-3">
          {/* Dotted connector line (desktop only) */}
          <div
            className="pointer-events-none absolute left-[16.67%] right-[16.67%] top-8 hidden h-px sm:block"
            style={{
              backgroundImage:
                'linear-gradient(to right, #B5D4F4 50%, transparent 50%)',
              backgroundSize: '12px 1px',
            }}
          />

          {STEPS.map((s) => (
            <div key={s.n} className="relative flex flex-col items-center text-center">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-[0_10px_30px_-8px_rgba(24,95,165,0.25)] ring-1 ring-[#E8F0FB]">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#185FA5] to-[#0C447C] text-[16px] font-semibold text-white">
                  {s.n}
                </div>
              </div>
              <h3 className="mb-2 text-[15px] font-semibold tracking-[-0.1px] text-[#111]">
                {s.title}
              </h3>
              <p className="max-w-[260px] text-[13px] leading-[1.6] text-[#666]">
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
