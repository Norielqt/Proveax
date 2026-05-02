import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useAuth } from '../context/AuthContext';
import LoadingScreen from '../components/layout/LoadingScreen';
import {
  createOnboardingSetupIntent,
  subscribeWithTrial,
  getOnboardingState,
} from '../api/onboarding';

const stripeKey     = import.meta.env.VITE_STRIPE_KEY;
if (stripeKey && !stripeKey.startsWith('pk_')) {
  console.error('[Stripe] VITE_STRIPE_KEY looks like a secret key (sk_...). Set the publishable key (pk_...) instead.');
}
const stripePromise = (stripeKey && stripeKey.startsWith('pk_')) ? loadStripe(stripeKey) : null;

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 99.99,
    seats: '1–5 users',
    tagline: 'For small teams getting started',
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
    tagline: 'For growing teams that need more',
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
    tagline: 'For large teams and brokerages',
    features: [
      'Unlimited team members',
      'Everything in Team',
      'API access & integrations',
      'Dedicated account manager',
      'Custom onboarding',
    ],
  },
];

export default function OnboardingPlan() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';

  const [step, setStep] = useState('plan'); // 'plan' | 'card' | 'done'
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [clientSecret, setClientSecret] = useState(null);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState('');
  // True for first-time signups; false on resubscribe after expiration.
  // Trial is one-time per tenant.
  const [canStartTrial, setCanStartTrial] = useState(true);

  // Non-admins shouldn't be here
  useEffect(() => {
    if (user && !isAdmin) navigate('/search', { replace: true });
  }, [user, isAdmin, navigate]);

  // Load whether this tenant is still trial-eligible
  useEffect(() => {
    if (!isAdmin) return;
    let mounted = true;
    getOnboardingState()
      .then((data) => { if (mounted) setCanStartTrial(!!data.can_start_trial); })
      .catch(() => { /* default true — backend is final source of truth */ });
    return () => { mounted = false; };
  }, [isAdmin]);

  const handleSelect = async (plan) => {
    setError('');
    setPreparing(true);
    setSelectedPlan(plan);
    try {
      const { client_secret } = await createOnboardingSetupIntent();
      setClientSecret(client_secret);
      setStep('card');
    } catch (e) {
      setError(e?.response?.data?.message || 'Could not start checkout. Please try again.');
      setSelectedPlan(null);
    } finally {
      setPreparing(false);
    }
  };

  const handleSubscribed = async () => {
    setStep('done');
    await refresh();
    setTimeout(() => navigate('/search', { replace: true }), 1800);
  };

  if (!user) return <LoadingScreen />;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F7FAFF] to-[#EEF4FC] px-4 py-12 md:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 text-center">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#185FA5]">
            Step {step === 'plan' ? '1 of 2' : step === 'card' ? '2 of 2' : 'Complete'}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900 md:text-[36px]">
            {step === 'done'
              ? 'Welcome aboard!'
              : canStartTrial
              ? 'Choose a plan to start your 7-day free trial'
              : 'Choose a plan to resubscribe'}
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-[15px] text-gray-600">
            {step === 'card'
              ? canStartTrial
                ? 'Add a card to start your 7 days free. You won’t be charged until your trial ends — cancel anytime from Settings.'
                : 'Add a card to reactivate your subscription. You’ll be charged today — the free trial was already used on this account.'
              : step === 'done'
              ? canStartTrial ? 'Your trial is active. Redirecting…' : 'Your subscription is active. Redirecting…'
              : canStartTrial
              ? 'Pick the plan that fits your team. We’ll save your card to charge automatically when the trial ends.'
              : 'The free trial has already been used on this workspace. Pick a plan to reactivate — billing starts immediately.'}
          </p>
        </div>

        {error && (
          <div className="mx-auto mb-6 max-w-2xl rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {step === 'plan' && (
          <div className="grid items-stretch gap-5 sm:grid-cols-3">
            {PLANS.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                disabled={preparing}
                loading={preparing && selectedPlan?.id === plan.id}
                canStartTrial={canStartTrial}
                onSelect={() => handleSelect(plan)}
              />
            ))}
          </div>
        )}

        {step === 'card' && selectedPlan && clientSecret && (
          <CardStep
            plan={selectedPlan}
            clientSecret={clientSecret}
            canStartTrial={canStartTrial}
            onBack={() => { setStep('plan'); setSelectedPlan(null); setClientSecret(null); }}
            onSuccess={handleSubscribed}
          />
        )}

        {step === 'done' && (
          <div className="mx-auto max-w-md rounded-2xl border border-green-200 bg-green-50 p-8 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="mt-4 text-lg font-semibold text-gray-900">
              {canStartTrial ? 'Trial activated' : 'Subscription activated'}
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              You're on the <span className="font-semibold">{selectedPlan?.name}</span> plan.
              {canStartTrial ? ' Enjoy 7 days free.' : ''}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function PlanCard({ plan, disabled, loading, canStartTrial, onSelect }) {
  return (
    <div
      className={`relative flex flex-col rounded-2xl bg-white p-8 transition-all duration-300 ${
        plan.popular
          ? 'scale-[1.02] border-2 border-[#185FA5] shadow-[0_20px_60px_-20px_rgba(24,95,165,0.35)] ring-4 ring-[#E6F1FB]'
          : 'border border-[#E8F0FB] hover:-translate-y-1 hover:border-[#B5D4F4] hover:shadow-[0_14px_40px_-12px_rgba(24,95,165,0.20)]'
      }`}
    >
      {plan.popular && (
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
      <ul className="mb-8 flex-1 space-y-2.5 text-[13.5px] leading-relaxed text-[#444]">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-[#E6F1FB] text-[#185FA5] ring-1 ring-inset ring-[#B5D4F4]/60">
              <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2.5 6.5 5 9l4.5-5" />
              </svg>
            </span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <button
        onClick={onSelect}
        disabled={disabled}
        className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 ${
          plan.popular
            ? 'bg-gradient-to-r from-[#185FA5] to-[#0C447C] text-white hover:opacity-95'
            : 'border border-[#185FA5] text-[#185FA5] hover:bg-[#E6F1FB]'
        }`}
      >
        {loading ? 'Preparing…' : (canStartTrial ? 'Start 7-day free trial' : `Subscribe · $${plan.price}/mo`)}
      </button>
    </div>
  );
}

function CardStep({ plan, clientSecret, canStartTrial, onBack, onSuccess }) {
  const appearance = useMemo(() => ({
    theme: 'stripe',
    variables: {
      colorPrimary: '#185FA5',
      colorBackground: '#ffffff',
      colorText: '#111827',
      colorDanger: '#dc2626',
      fontFamily: 'DM Sans, system-ui, sans-serif',
      spacingUnit: '4px',
      borderRadius: '10px',
    },
  }), []);

  if (!stripePromise) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        Stripe is not configured. Set <code>VITE_STRIPE_KEY</code> in your env.
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-[1fr,360px]">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Change plan
        </button>
        <h3 className="mt-4 text-lg font-semibold text-gray-900">Payment details</h3>
        <p className="mt-1 text-sm text-gray-500">
          {canStartTrial
            ? "We'll save this card and charge it automatically when your trial ends."
            : "You'll be charged today to reactivate your subscription."}
        </p>
        <div className="mt-5">
          <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
            <CardForm plan={plan} canStartTrial={canStartTrial} onSuccess={onSuccess} />
          </Elements>
        </div>
      </div>

      <aside className="h-fit rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Order summary</h4>
        <div className="mt-4 flex items-baseline justify-between">
          <span className="text-base font-semibold text-gray-900">{plan.name}</span>
          <span className="text-xs text-gray-500">{plan.seats}</span>
        </div>
        <div className="mt-4 flex items-baseline justify-between border-t border-gray-100 pt-4">
          <span className="text-sm text-gray-600">Monthly</span>
          <span className="text-2xl font-bold text-gray-900">
            ${plan.price.toFixed(2)}
          </span>
        </div>
        <div className="mt-4 rounded-lg bg-blue-50 p-3 text-xs text-blue-900">
          {canStartTrial ? (
            <>
              <p className="font-semibold">Today: $0.00</p>
              <p className="mt-1 text-blue-800">
                Free for 7 days. We'll charge ${plan.price.toFixed(2)}/mo when your trial ends.
                Cancel anytime from Settings.
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold">Today: ${plan.price.toFixed(2)}</p>
              <p className="mt-1 text-blue-800">
                Reactivating your subscription. The 7-day free trial was already used on this account.
                Cancel anytime from Settings.
              </p>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

function CardForm({ plan, canStartTrial, onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setError('');
    setBusy(true);

    const { error: confirmErr, setupIntent } = await stripe.confirmSetup({
      elements,
      redirect: 'if_required',
    });

    if (confirmErr) {
      setError(confirmErr.message || 'Card could not be saved.');
      setBusy(false);
      return;
    }

    const pmId =
      setupIntent?.payment_method ??
      setupIntent?.payment_method?.id;

    if (!pmId) {
      setError('Card was not saved. Please try again.');
      setBusy(false);
      return;
    }

    try {
      await subscribeWithTrial(plan.id, pmId);
      await onSuccess();
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not start subscription. Please try again.');
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
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || busy}
        className="mt-6 w-full rounded-lg bg-gradient-to-r from-[#185FA5] to-[#0C447C] py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-50"
      >
        {busy ? 'Setting up…' : (canStartTrial ? `Start free trial · $0.00 today` : `Subscribe · $${plan.price.toFixed(2)} today`)}
      </button>
      <p className="mt-3 text-center text-xs text-gray-400">
        Payments secured by <span className="font-semibold text-gray-500">Stripe</span> · You won't be charged today
      </p>
    </form>
  );
}
