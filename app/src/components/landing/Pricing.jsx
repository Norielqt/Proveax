import { Link } from 'react-router-dom';

const PLANS = [
  {
    name: 'Starter',
    price: '$49',
    per: '/mo',
    features: ['1 admin + 3 employees', 'Unlimited property search', 'Map + list views', 'Email support'],
    cta: 'Start free trial',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$149',
    per: '/mo',
    features: ['1 admin + 15 employees', 'Everything in Starter', 'Skip tracing included', 'Priority support'],
    cta: 'Start free trial',
    highlighted: true,
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
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-xl border p-6 ${plan.highlighted ? 'border-blue-600 bg-white shadow-lg ring-1 ring-blue-600' : 'border-gray-200 bg-white'}`}
            >
              <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
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
