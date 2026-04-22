import { Link } from 'react-router-dom';

const PLANS = [
  {
    name: 'Starter',
    price: '$99.99',
    per: '/mo',
    seats: '1–5 users',
    features: ['Up to 5 team members', 'Unlimited property search', 'Time tracking & timesheets', 'Email support'],
    cta: 'Start free trial',
    highlighted: false,
  },
  {
    name: 'Team',
    price: '$189.99',
    per: '/mo',
    seats: '6–10 users',
    features: ['Up to 10 team members', 'Everything in Starter', 'CRM & shared leads', 'Priority support'],
    cta: 'Start free trial',
    highlighted: true,
  },
  {
    name: 'Business',
    price: '$249.99',
    per: '/mo',
    seats: '10+ users',
    features: ['Unlimited team members', 'Everything in Team', 'API access & integrations', 'Dedicated account manager'],
    cta: 'Start free trial',
    highlighted: false,
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="w-full bg-gray-50 py-16">
      <div className="mx-auto max-w-5xl px-4 md:px-8">
        <div className="text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Simple, honest pricing</h2>
          <p className="mt-2 text-gray-600">7-day free trial on every plan. No credit card required.</p>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-xl border p-6 ${plan.highlighted ? 'border-blue-600 bg-white shadow-lg ring-1 ring-blue-600' : 'border-gray-200 bg-white'}`}
            >
              <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
              <p className="mt-1 text-sm text-gray-500">{plan.seats}</p>
              <div className="mt-3 flex items-baseline">
                <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                <span className="ml-1 text-gray-500">{plan.per}</span>
              </div>
              <ul className="mt-6 space-y-2 text-sm text-gray-700">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <span className="text-blue-600">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                to="/register"
                className={`mt-6 block w-full rounded-md px-4 py-2 text-center text-sm font-semibold ${
                  plan.highlighted ? 'bg-blue-600 text-white hover:bg-blue-700' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
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
