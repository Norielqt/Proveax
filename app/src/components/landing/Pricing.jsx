import { Link } from 'react-router-dom';

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: '99.99',
    seats: '1–5 users',
    tagline: 'For small teams getting started',
    features: [
      'Up to 5 team members',
      'Unlimited property search',
      'Time tracking & timesheets',
      'Screenshots & activity',
      'Email support',
    ],
    pop: false,
    cta: 'Get started',
  },
  {
    id: 'team',
    name: 'Team',
    price: '189.99',
    seats: '6–10 users',
    tagline: 'For growing teams that need more',
    features: [
      'Up to 10 team members',
      'Everything in Starter',
      'CRM & shared lead pipeline',
      'Advanced reporting',
      'Priority support',
    ],
    pop: true,
    cta: 'Start free trial',
  },
  {
    id: 'business',
    name: 'Business',
    price: '249.99',
    seats: '10+ users',
    tagline: 'For large teams and brokerages',
    features: [
      'Unlimited team members',
      'Everything in Team',
      'API access & integrations',
      'Dedicated account manager',
      'Custom onboarding',
    ],
    pop: false,
    cta: 'Get started',
  },
];

function CheckIcon({ pop }) {
  return (
    <span
      className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full ${
        pop
          ? 'bg-gradient-to-br from-[#185FA5] to-[#0C447C] text-white'
          : 'bg-[#E6F1FB] text-[#185FA5] ring-1 ring-inset ring-[#B5D4F4]/60'
      }`}
    >
      <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2.5 6.5 5 9l4.5-5" />
      </svg>
    </span>
  );
}

export default function Pricing() {
  return (
    <section
      id="pricing"
      className="relative overflow-hidden border-b border-t border-[#E8F0FB] bg-gradient-to-b from-[#F7FAFF] to-[#EEF4FC] px-6 py-24 md:px-10"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 text-center">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#185FA5]">
            Pricing
          </p>
          <h2 className="mx-auto mb-4 max-w-[620px] text-[32px] font-semibold leading-[1.15] tracking-[-0.5px] text-[#111] md:text-[38px]">
            Simple, transparent pricing
          </h2>
          <p className="mx-auto max-w-[520px] text-[15px] leading-[1.65] text-[#555]">
            Start free and scale as your team grows. No hidden fees, no lock-in contracts.
          </p>
        </div>

        <div className="grid items-stretch gap-5 sm:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-2xl p-8 transition-all duration-300 ${
                plan.pop
                  ? 'scale-[1.02] border-2 border-[#185FA5] bg-white shadow-[0_20px_60px_-20px_rgba(24,95,165,0.35)] ring-4 ring-[#E6F1FB]'
                  : 'border border-[#E8F0FB] bg-white hover:-translate-y-1 hover:border-[#B5D4F4] hover:shadow-[0_14px_40px_-12px_rgba(24,95,165,0.20)]'
              }`}
            >
              {plan.pop && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#185FA5] to-[#0C447C] px-3.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-white shadow-md shadow-[#185FA5]/30">
                  Most popular
                </span>
              )}

              <p className="mb-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-[#888]">
                {plan.name}
              </p>

              <div className="mb-1 flex items-baseline text-[#111]">
                <sup className="mr-0.5 mt-2 text-xl font-medium text-[#185FA5]">$</sup>
                <span className="text-[44px] font-semibold leading-none tracking-[-1px]">
                  {plan.price}
                </span>
                <span className="ml-1 text-sm text-[#888]">/mo</span>
              </div>

              <p className="mb-1 text-[12px] font-medium text-[#185FA5]">{plan.seats}</p>

              <p className="mb-6 border-b border-[#E8F0FB] pb-6 text-[13px] text-[#888]">
                {plan.tagline}
              </p>

              <ul className="mb-8 flex flex-col gap-3">
                {plan.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2.5 text-[13px] leading-[1.5] text-[#444]"
                  >
                    <CheckIcon pop={plan.pop} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <Link
                to="/register"
                className={`mt-auto block w-full rounded-xl py-3 text-center text-[13px] font-semibold transition-all ${
                  plan.pop
                    ? 'bg-gradient-to-br from-[#185FA5] to-[#0C447C] text-white shadow-md shadow-[#185FA5]/25 hover:shadow-lg hover:shadow-[#185FA5]/35'
                    : 'border border-[#B5D4F4] bg-white text-[#185FA5] hover:bg-[#E6F1FB]'
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}