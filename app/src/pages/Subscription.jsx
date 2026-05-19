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
if (stripeKey && !stripeKey.startsWith('pk_')) {
  console.error('[Stripe] VITE_STRIPE_KEY looks like a secret key (sk_...). Set the publishable key (pk_...) instead.');
}
const stripePromise = (stripeKey && stripeKey.startsWith('pk_')) ? loadStripe(stripeKey) : null;

const INCLUDED = [
  'Unlimited property search',
  'Built-in CRM',
  'Team management',
  'Lead pipeline',
  'Time tracking & timesheets',
  'Screenshots & activity',
  'Reporting & analytics',
  'Email support',
];

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 99.99,
    seats: '1-5 users',
    tagline: 'Perfect for small teams and solo agents.',
    features: INCLUDED,
  },
  {
    id: 'team',
    name: 'Team',
    price: 189.99,
    seats: '6-10 users',
    tagline: 'Best for growing teams that move fast.',
    popular: true,
    features: INCLUDED,
  },
  {
    id: 'business',
    name: 'Business',
    price: 249.99,
    seats: '10+ users',
    tagline: 'Built for large brokerages and enterprises.',
    features: INCLUDED,
  },
];

function CancelModal({ onConfirm, onClose, canceling }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-[0_18px_50px_-15px_rgba(17,17,17,0.25)]">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-50/60">
            <svg className="h-5 w-5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-[#111]">Cancel subscription?</h3>
            <p className="mt-1 text-sm text-[#888]">
              Your subscription will be canceled but you'll keep full access until the end of the current billing period. You can resubscribe at any time.
            </p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={canceling}
            className="rounded-full border border-black/[0.06] bg-white px-4 py-2 text-sm font-semibold text-[#5a5a55] hover:bg-[#f9f9f9] disabled:opacity-50"
          >
            Keep subscription
          </button>
          <button
            onClick={onConfirm}
            disabled={canceling}
            className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
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
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#888]">Account</p>
      <h1 className="mt-1 font-display text-4xl leading-none tracking-tight text-[#111]">Subscription</h1>
      <p className="mt-2 text-sm text-[#5a5a55]">Manage your plan and billing.</p>

      {/* Active subscription card */}
      {isActive && (
        <div className="mt-6 rounded-2xl border border-black/[0.06] bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f5f5f5] px-2.5 py-0.5 text-xs font-semibold text-[#5a5a55]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#111]" />
                  Active
                </span>
                {currentPlan && <span className="text-xs text-[#888]">{currentPlan.seats}</span>}
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <h2 className="text-2xl font-bold text-[#111]">{currentPlan?.name ?? 'Subscribed'}</h2>
                {currentPlan && (
                  <>
                    <span className="text-sm text-[#888]">·</span>
                    <span className="text-lg font-semibold text-[#5a5a55]">${currentPlan.price}<span className="text-sm font-normal text-[#888]">/mo</span></span>
                  </>
                )}
              </div>
              {status.subscription_ends_at && (
                <p className="mt-2 text-sm text-[#888]">
                  Renews on <span className="font-medium text-[#5a5a55]">{new Date(status.subscription_ends_at).toLocaleDateString()}</span>
                </p>
              )}
            </div>
            {isAdmin && (
              <button
                onClick={handleCancel}
                className="rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50/60"
              >
                Cancel subscription
              </button>
            )}
          </div>
          {currentPlan && (
            <div className="mt-5 border-t border-black/[0.04] pt-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#aaa]">What's included</p>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {currentPlan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-[#5a5a55]">
                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-[#111]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
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
        <div className="mt-6 rounded-2xl border border-amber-200/60 bg-amber-50/60 p-6">
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
        <div className="mt-6 rounded-2xl border border-black/[0.06] bg-[#f5f5f5] p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-[#5a5a55] ring-1 ring-black/[0.06]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#111]" />
                  Free Trial
                </span>
                {currentPlan && (
                  <span className="inline-flex items-center rounded-full border border-black/[0.06] bg-white px-2.5 py-0.5 text-xs font-semibold text-[#111]">
                    {currentPlan.name} Plan
                  </span>
                )}
              </div>

              <div className="mt-3 flex items-baseline gap-2">
                <h2 className="font-display text-3xl font-bold text-[#111] leading-tight">
                  {currentPlan?.name ?? 'Free Trial'}
                </h2>
                {currentPlan && (
                  <>
                    <span className="text-sm text-[#888]">·</span>
                    <span className="text-lg font-semibold text-[#111]">
                      ${currentPlan.price}
                      <span className="text-sm font-normal text-[#888]">/mo after trial</span>
                    </span>
                  </>
                )}
              </div>

              {status.trial_ends_at && (
                <p className="mt-1.5 text-sm text-[#5a5a55]">
                  Trial ends on{' '}
                  <span className="font-semibold">
                    {new Date(status.trial_ends_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                  {status.days_left != null && (
                    <span className="ml-1.5 inline-flex items-center rounded-full bg-[#111] px-2 py-0.5 text-xs font-semibold text-white">
                      {status.days_left} day{status.days_left === 1 ? '' : 's'} left
                    </span>
                  )}
                </p>
              )}

              {currentPlan && (
                <div className="mt-4 border-t border-black/[0.08] pt-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#888]">What's included</p>
                  <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                    {currentPlan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-[#5a5a55]">
                        <svg className="mt-0.5 h-4 w-4 shrink-0 text-[#111]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Plans */}
      {!selected && (
        <div className="mt-10">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#888]">
            {isCanceled ? 'Resubscribe' : isActive ? 'Plans' : 'Choose a plan'}
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {PLANS.map((plan) => {
              const isCurrentPlan = isActive && currentPlan?.id === plan.id;
              const highlighted = plan.popular;
              return (
                <div
                  key={plan.id}
                  className={`relative flex flex-col rounded-xl border p-6 ${
                    isCurrentPlan
                      ? 'border-black/[0.08] bg-[#f5f5f5] ring-1 ring-[#111]/10'
                      : highlighted
                      ? 'border-[#111] bg-white shadow-[0_18px_50px_-15px_rgba(17,17,17,0.25)] ring-1 ring-[#111]'
                      : 'border-black/[0.06] bg-white'
                  }`}
                >
                  {isCurrentPlan && (
                    <span className="absolute -top-3 left-6 rounded-full bg-[#111] px-3 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
                      Current plan
                    </span>
                  )}
                  {!isCurrentPlan && highlighted && (
                    <span className="absolute -top-3 left-6 rounded-full bg-[#111] px-3 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
                      Most popular
                    </span>
                  )}
                  <h3 className="text-lg font-semibold text-[#111]">{plan.name}</h3>
                  <p className="mt-0.5 text-xs text-[#888]">{plan.seats}</p>
                  <p className="mt-3 text-sm text-[#5a5a55] leading-relaxed">{plan.tagline}</p>
                  <div className="mt-4 flex items-baseline">
                    <span className="font-display text-5xl font-bold text-[#111] leading-none">${plan.price}</span>
                    <span className="ml-1 text-sm text-[#888]">/month</span>
                  </div>
                  <ul className="mt-6 flex-1 space-y-2 text-sm text-[#5a5a55]">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <span className="mt-0.5 text-[#111]">✓</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => handleSelect(plan)}
                    disabled={!!preparing || isCurrentPlan || !isAdmin}
                    className={`mt-6 w-full rounded-full px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
                      isCurrentPlan
                        ? 'border border-black/[0.08] bg-[#f5f5f5] text-[#5a5a55] cursor-default'
                        : highlighted
                        ? 'bg-[#111] text-white hover:bg-[#2a2a2a]'
                        : 'border border-black/[0.06] text-[#111] hover:bg-[#f9f9f9]'
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
      colorPrimary: '#111111',
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
      <div className="mt-8 rounded-2xl border border-black/[0.06] bg-[#f5f5f5] p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#f5f5f5]">
          <svg className="h-8 w-8 text-[#111]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="mt-4 text-lg font-semibold text-[#111]">Subscription activated</h3>
        <p className="mt-1 text-sm text-[#5a5a55]">You're now on the <span className="font-semibold">{plan.name}</span> plan.</p>
      </div>
    );
  }

  if (!stripePromise) {
    return (
      <div className="mt-8 rounded-2xl border border-amber-200/60 bg-amber-50/60 p-6 text-sm text-amber-800">
        Stripe is not configured. Set <code>VITE_STRIPE_KEY</code> in your env.
      </div>
    );
  }

  return (
    <div className="mt-8 grid gap-6 md:grid-cols-[1fr,360px]">
      {/* Left: payment form */}
      <div className="rounded-2xl border border-black/[0.06] bg-white p-6">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm font-medium text-[#5a5a55] hover:text-[#111]"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Change plan
          </button>
        </div>

        <h3 className="mt-4 text-lg font-semibold text-[#111]">Payment details</h3>
        <p className="mt-1 text-sm text-[#888]">Enter your card to activate the {plan.name} plan.</p>

        <div className="mt-5">
          <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
            <PaymentForm plan={plan} onSuccess={onSuccess} />
          </Elements>
        </div>
      </div>

      {/* Right: summary */}
      <aside className="h-fit rounded-2xl border border-black/[0.06] bg-white p-6">
        <h4 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#888]">Order summary</h4>
        <div className="mt-4 flex items-baseline justify-between">
          <span className="text-base font-semibold text-[#111]">{plan.name}</span>
          <span className="text-sm text-[#888]">{plan.seats}</span>
        </div>
        <div className="mt-4 flex items-baseline justify-between border-t border-black/[0.04] pt-4">
          <span className="text-sm text-[#5a5a55]">Monthly</span>
          <span className="text-2xl font-bold text-[#111]">${plan.price.toFixed(2)}</span>
        </div>
        <div className="mt-4 rounded-md bg-[#f9f9f9] p-3 text-xs text-[#5a5a55]">
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
          wallets: { googlePay: 'never', applePay: 'never' },
          terms: { card: 'never', usBankAccount: 'never', link: 'never' },
        }}
      />

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-rose-50/60 px-3 py-2 text-sm font-medium text-rose-700">
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || busy}
        className="mt-6 w-full rounded-full bg-[#111] py-3 text-sm font-semibold text-white transition hover:bg-[#2a2a2a] disabled:opacity-50"
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
      <p className="mt-3 text-center text-xs text-[#aaa]">
        Payments processed securely by <span className="font-semibold text-[#888]">Stripe</span>
      </p>
    </form>
  );
}
