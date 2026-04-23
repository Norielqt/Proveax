import { Link } from 'react-router-dom';

export default function CtaSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-[#0C447C] via-[#185FA5] to-[#0C447C] px-6 py-24 md:px-10">
      {/* Decorative blurred orbs */}
      <div
        className="pointer-events-none absolute -left-20 top-10 h-72 w-72 rounded-full opacity-30 blur-3xl"
        style={{ background: 'radial-gradient(circle, #85B7EB, transparent 70%)' }}
      />
      <div
        className="pointer-events-none absolute -right-16 bottom-0 h-80 w-80 rounded-full opacity-25 blur-3xl"
        style={{ background: 'radial-gradient(circle, #378ADD, transparent 70%)' }}
      />
      {/* Subtle dot grid */}
      <div
        className="absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)',
          backgroundSize: '32px 32px',
        }}
      />

      <div className="relative mx-auto max-w-3xl text-center">
        <h2 className="mb-4 text-[34px] font-semibold leading-[1.15] tracking-[-0.8px] text-white md:text-[42px]">
          Start searching properties today
        </h2>
        <p className="mx-auto mb-10 max-w-[500px] text-[16px] leading-[1.6] text-[#B5D4F4]">
          Join thousands of real estate professionals who rely on Proveax for accurate,
          up-to-date property data.
        </p>
        <Link
          to="/register"
          className="group inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-[15px] font-semibold text-[#185FA5] shadow-xl shadow-black/10 transition-all hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-black/20"
        >
          Search properties free
          <svg
            viewBox="0 0 20 20"
            fill="none"
            className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
          >
            <path
              d="M4 10h12M11 5l5 5-5 5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
        <p className="mt-5 text-xs text-[#85B7EB]">
          No credit card required&nbsp;·&nbsp;Free 14-day trial&nbsp;·&nbsp;Cancel anytime
        </p>
      </div>
    </section>
  );
}
