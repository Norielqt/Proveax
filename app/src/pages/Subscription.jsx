import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useAuth } from '../context/AuthContext';
import LoadingScreen from '../components/layout/LoadingScreen';
import {
  getSubscriptionStatus,
  createSubscriptionIntent,
  confirmSubscription,
  cancelSubscription,
} from '../api/subscription';

const stripeKey     = import.meta.env.VITE_STRIPE_KEY;
const stripePromise = stripeKey ? loadStripe(stripeKey) : null;

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 99.99,
    seats: '1–5 users',
    features: [
      'Up to 5 team members',
      'Unlimited property search',
      'Time tracking & timesheets',
      'Screenshots & activity',
      'Email support',
    ],
  },
  {
    id: 'team',
    name: 'Team',
    price: 189.99,
    seats: '6–10 users',
    popular: true,
    features: [
      'Up to 10 team members',
      'Everything in Starter',
      'CRM & shared lead pipeline',
      'Advanced reporting',
      'Priority support',
    ],
  },
  {
    id: 'business',
    name: 'Business',
    price: 249.99,
    seats: '10+ users',
    features: [
      'Unlimited team members',
      'Everything in Team',
      'API access & integrations',
      'Dedicated account manager',
      'Custom onboarding',
    ],
  },
];

function CancelModal({ onConfirm, onClose, canceling }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50">
            <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">Cancel subscription?</h3>
            <p className="mt-1 text-sm text-gray-500">
              Your subscription will be canceled but you'll keep full access until the end of the current billing period. You can resubscribe at any time.
            </p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={canceling}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Keep subscription
          </button>
          <button
            onClick={onConfirm}
            disabled={canceling}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {canceling ? 'Canceling…' : 'Yes, cancel'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Subscription() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';
  const [status, setStatus]       = useState(null);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState(null); // { plan, clientSecret }
  const [preparing, setPreparing] = useState(null); // planId
  const [success, setSuccess]     = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [canceling, setCanceling]   = useState(false);

  useEffect(() => {
    getSubscriptionStatus()
      .then(setStatus)
      .finally(() => setLoading(false));
  }, []);

  const handleSelect = async (plan) => {
    // The legacy one-off PaymentIntent flow is removed. Admins should always
    // go through /onboarding/plan, which handles trial-aware subscriptions.
    navigate('/onboarding/plan');
  };

  const handlePaid = async (paymentIntentId) => {
    await confirmSubscription(paymentIntentId, selected.plan.id);
    await refresh();
    const fresh = await getSubscriptionStatus();
    setStatus(fresh);
    setSuccess(true);
    setTimeout(() => { setSelected(null); setSuccess(false); }, 2500);
  };

  const handleCancel = () => setShowCancel(true);

  const confirmCancel = async () => {
    setCanceling(true);
    try {
      await cancelSubscription();
      await refresh();
      const fresh = await getSubscriptionStatus();
      setStatus(fresh);
      setShowCancel(false);
    } finally {
      setCanceling(false);
    }
  };

  if (loading) return <LoadingScreen />;

  const isActive    = !!status?.is_active;
  const isCanceled  = !!status?.is_canceled;
  const isTrialing  = status?.status === 'trialing';
  const currentPlan = status?.plan ? PLANS.find((p) => p.id === status.plan) : null;

  return (
  <>
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      <h1 className="text-2xl font-bold text-gray-900">Subscription</h1>
      <p className="mt-1 text-sm text-gray-500">Manage your plan and billing.</p>

      {/* Active subscription card */}
      {isActive && (
        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  Active
                </span>
                {currentPlan && <span className="text-xs text-gray-500">{currentPlan.seats}</span>}
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <h2 className="text-2xl font-bold text-gray-900">{currentPlan?.name ?? 'Subscribed'}</h2>
                {currentPlan && (
                  <>
                    <span className="text-sm text-gray-500">·</span>
                    <span className="text-lg font-semibold text-gray-700">${currentPlan.price}<span className="text-sm font-normal text-gray-500">/mo</span></span>
                  </>
                )}
              </div>
              {status.subscription_ends_at && (
                <p className="mt-2 text-sm text-gray-500">
                  Renews on <span className="font-medium text-gray-700">{new Date(status.subscription_ends_at).toLocaleDateString()}</span>
                </p>
              )}
            </div>
            {isAdmin && (
              <button
                onClick={handleCancel}
                className="rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
              >
                Cancel subscription
              </button>
            )}
          </div>
          {currentPlan && (
            <div className="mt-5 border-t border-gray-100 pt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">What's included</p>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {currentPlan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Canceled banner */}
      {isCanceled && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-6">
          <div className="flex items-start gap-3">
            <svg className="h-5 w-5 shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h3 className="text-sm font-semibold text-amber-900">Your subscription is canceled</h3>
              <p className="mt-1 text-sm text-amber-800">
                You'll keep access until{' '}
                {status.subscription_ends_at
                  ? <span className="font-semibold">{new Date(status.subscription_ends_at).toLocaleDateString()}</span>
                  : 'the end of the current period'}.
                {' '}Choose a plan below to resubscribe.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Trial card */}
      {isTrialing && !selected && (
        <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-blue-900">You're on a Free Trial</h3>
              {status.trial_ends_at && (
                <p className="mt-1 text-sm text-blue-800">
                  Trial ends on <span className="font-semibold">{new Date(status.trial_ends_at).toLocaleDateString()}</span>
                  {status.days_left !== null && ` (${status.days_left} day${status.days_left === 1 ? '' : 's'} left)`}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Plans */}
      {!selected && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900">
            {isCanceled ? 'Resubscribe' : isActive ? 'Plans' : 'Choose a plan'}
          </h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {PLANS.map((plan) => {
              const isCurrentPlan = isActive && currentPlan?.id === plan.id;
              const highlighted = plan.popular;
              return (
                <div
                  key={plan.id}
                  className={`relative flex flex-col rounded-xl border p-6 ${
                    isCurrentPlan
                      ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                      : highlighted
                      ? 'border-blue-600 bg-white shadow-lg ring-1 ring-blue-600'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  {isCurrentPlan && (
                    <span className="absolute -top-3 left-6 rounded-full bg-blue-600 px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
                      Current plan
                    </span>
                  )}
                  {!isCurrentPlan && highlighted && (
                    <span className="absolute -top-3 left-6 rounded-full bg-blue-600 px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
                      Most popular
                    </span>
                  )}
                  <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                  <p className="mt-1 text-sm text-gray-500">{plan.seats}</p>
                  <div className="mt-4 flex items-baseline">
                    <span className="text-4xl font-bold text-gray-900">${plan.price}</span>
                    <span className="ml-1 text-sm text-gray-500">/month</span>
                  </div>
                  <ul className="mt-6 flex-1 space-y-2 text-sm text-gray-700">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <span className="mt-0.5 text-blue-600">✓</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => handleSelect(plan)}
                    disabled={!!preparing || isCurrentPlan || !isAdmin}
                    className={`mt-6 w-full rounded-md px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${
                      isCurrentPlan
                        ? 'border border-blue-500 bg-blue-100 text-blue-700 cursor-default'
                        : highlighted
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {isCurrentPlan ? 'Current plan' : preparing === plan.id ? 'Preparing…' : 'Choose plan'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selected && isAdmin && (
        <PaymentPanel
          plan={selected.plan}
          clientSecret={selected.clientSecret}
          onBack={() => setSelected(null)}
          onSuccess={handlePaid}
          success={success}
        />
      )}
    </div>

    {showCancel && (
      <CancelModal
        onConfirm={confirmCancel}
        onClose={() => setShowCancel(false)}
        canceling={canceling}
      />
    )}
  </>
  );
}

/* ============================================================================
   Payment panel — mirrors WalletDrawer card setup
============================================================================ */
function PaymentPanel({ plan, clientSecret, onBack, onSuccess, success }) {
  const appearance = useMemo(() => ({
    theme: 'stripe',
    variables: {
      colorPrimary: '#2563eb',
      colorBackground: '#ffffff',
      colorText: '#111827',
      colorDanger: '#dc2626',
      fontFamily: 'system-ui, sans-serif',
      spacingUnit: '4px',
      borderRadius: '10px',
    },
  }), []);

  if (success) {
    return (
      <div className="mt-8 rounded-xl border border-green-200 bg-green-50 p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
          <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="mt-4 text-lg font-semibold text-gray-900">Subscription activated</h3>
        <p className="mt-1 text-sm text-gray-600">You're now on the <span className="font-semibold">{plan.name}</span> plan.</p>
      </div>
    );
  }

  if (!stripePromise) {
    return (
      <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        Stripe is not configured. Set <code>VITE_STRIPE_KEY</code> in your env.
      </div>
    );
  }

  return (
    <div className="mt-8 grid gap-6 md:grid-cols-[1fr,360px]">
      {/* Left: payment form */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Change plan
          </button>
        </div>

        <h3 className="mt-4 text-lg font-semibold text-gray-900">Payment details</h3>
        <p className="mt-1 text-sm text-gray-500">Enter your card to activate the {plan.name} plan.</p>

        <div className="mt-5">
          <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
            <PaymentForm plan={plan} onSuccess={onSuccess} />
          </Elements>
        </div>
      </div>

      {/* Right: summary */}
      <aside className="h-fit rounded-xl border border-gray-200 bg-white p-6">
        <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Order summary</h4>
        <div className="mt-4 flex items-baseline justify-between">
          <span className="text-base font-semibold text-gray-900">{plan.name}</span>
          <span className="text-sm text-gray-500">{plan.seats}</span>
        </div>
        <div className="mt-4 flex items-baseline justify-between border-t border-gray-100 pt-4">
          <span className="text-sm text-gray-600">Monthly</span>
          <span className="text-2xl font-bold text-gray-900">${plan.price.toFixed(2)}</span>
        </div>
        <div className="mt-4 rounded-md bg-gray-50 p-3 text-xs text-gray-600">
          Billed monthly. Cancel anytime from this page.
        </div>
      </aside>
    </div>
  );
}

function PaymentForm({ plan, onSuccess }) {
  const stripe   = useStripe();
  const elements = useElements();
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setError(''); setBusy(true);

    const { error: err, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });

    if (err) {
      setError(err.message || 'Payment failed.');
      setBusy(false);
      return;
    }

    if (paymentIntent?.status === 'succeeded') {
      try {
        await onSuccess(paymentIntent.id);
      } catch {
        setError('Payment succeeded but activation failed. Please contact support.');
        setBusy(false);
      }
    } else {
      setError('Payment was not completed.');
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <PaymentElement
        options={{
          layout: 'tabs',
          paymentMethodOrder: ['card'],
          fields: { billingDetails: 'auto' },
          terms: { card: 'never' },
        }}
      />

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || busy}
        className="mt-6 w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
      >
        {busy ? (
          <span className="inline-flex items-center justify-center gap-2">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            Processing…
          </span>
        ) : (
          <>Subscribe · ${plan.price.toFixed(2)}/mo</>
        )}
      </button>
      <p className="mt-3 text-center text-xs text-gray-400">
        Payments processed securely by <span className="font-semibold text-gray-500">Stripe</span>
      </p>
    </form>
  );
}
