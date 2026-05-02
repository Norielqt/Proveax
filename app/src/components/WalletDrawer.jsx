import { useEffect, useMemo, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import {
  getWalletSummary,
  getTransactions,
  createTopUpIntent,
  chargeSavedCard,
  confirmTopUp,
} from '../api/wallet';
import { useAuth } from '../context/AuthContext';

const stripeKey     = import.meta.env.VITE_STRIPE_KEY;
if (stripeKey && !stripeKey.startsWith('pk_')) {
  console.error('[Stripe] VITE_STRIPE_KEY looks like a secret key (sk_...). Set the publishable key (pk_...) instead.');
}
const stripePromise = (stripeKey && stripeKey.startsWith('pk_')) ? loadStripe(stripeKey) : null;

const RATE_PER_TRACE = 0.20;
const MIN_TRACES     = 100;
const MAX_TRACES     = 10000;

const PACKAGES = [
  { traces: 100,  popular: false },
  { traces: 250,  popular: true  },
  { traces: 500,  popular: false },
  { traces: 1000, popular: false },
];

const fmtMoney  = (n) => `$${Number(n).toFixed(2)}`;
const fmtTraces = (n) => Number(n).toLocaleString();

/* ============================================================================
   Drawer shell
============================================================================ */
export default function WalletDrawer({ open, onClose }) {
  const { user, refresh } = useAuth();
  const [tab, setTab]         = useState('add');
  const [summary, setSummary] = useState(null); // { balance, skip_traces, card }
  const [stage, setStage]     = useState('select'); // select | confirm | elements | success
  const [traces, setTraces]   = useState(null);
  const [clientSecret, setClientSecret] = useState(null);

  // Fetch summary (card info) whenever the drawer opens.
  useEffect(() => {
    if (open) {
      getWalletSummary().then(setSummary).catch(() => {});
    } else {
      const t = setTimeout(() => {
        setTab('add');
        setStage('select');
        setTraces(null);
        setClientSecret(null);
      }, 350);
      return () => clearTimeout(t);
    }
  }, [open]);

  const balance     = Number(summary?.balance ?? user?.balance ?? 0);
  const skipTraces  = Math.floor(balance / RATE_PER_TRACE);
  const card        = summary?.card ?? null;
  const hasCard     = !!card;

  const handlePackagePicked = (n) => {
    setTraces(n);
    setStage(hasCard ? 'confirm' : 'elements');
    if (!hasCard) {
      // Need to collect a card via Elements — create the intent now.
      createTopUpIntent(n)
        .then((res) => setClientSecret(res.client_secret))
        .catch(() => setStage('select'));
    }
  };

  const handleSavedCardCharge = async () => {
    const res = await chargeSavedCard(traces);
    if (res.status === 'requires_action') {
      // 3DS: hand off to Stripe.js for confirmation.
      const stripe = await stripePromise;
      const { paymentIntent, error } = await stripe.confirmCardPayment(res.client_secret);
      if (error || paymentIntent?.status !== 'succeeded') {
        throw new Error(error?.message || 'Authentication failed.');
      }
      await confirmTopUp(paymentIntent.id);
    }
    await refresh();
    const fresh = await getWalletSummary();
    setSummary(fresh);
    setStage('success');
    setTimeout(() => { setStage('select'); setTraces(null); setTab('tx'); }, 2200);
  };

  const handleElementsSuccess = async (paymentIntentId) => {
    await confirmTopUp(paymentIntentId);
    await refresh();
    const fresh = await getWalletSummary();
    setSummary(fresh);
    setStage('success');
    setTimeout(() => { setStage('select'); setTraces(null); setClientSecret(null); setTab('tx'); }, 2200);
  };

  const showHeader = stage !== 'success';

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-[1300] transition-all duration-300 ${
          open ? 'bg-black/50 backdrop-blur-sm' : 'pointer-events-none bg-transparent'
        }`}
      />

      <aside
        className={`fixed right-0 top-0 z-[1301] flex h-full w-full max-w-[420px] flex-col bg-[#f8f9fc] shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* ── Hero header ── */}
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-blue-700 px-6 pb-8 pt-5">
          <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-14 -left-6 h-44 w-44 rounded-full bg-white/5" />
          <div className="pointer-events-none absolute bottom-4 right-16 h-20 w-20 rounded-full bg-white/10" />

          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-2">
              {(stage === 'confirm' || stage === 'elements') && (
                <button
                  onClick={() => { setStage('select'); setTraces(null); setClientSecret(null); }}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 transition-colors"
                  aria-label="Back"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}
              <span className="text-xs font-semibold uppercase tracking-widest text-white/60">
                {stage === 'confirm' ? 'Confirm purchase' :
                 stage === 'elements' ? 'Checkout' :
                 'Skip Traces'}
              </span>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 transition-colors"
              aria-label="Close"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {showHeader && stage === 'select' && (
            <div className="relative mt-5">
              <p className="text-sm font-medium text-white/60">Skip traces remaining</p>
              <p className="mt-1 text-5xl font-bold tracking-tight text-white">
                {fmtTraces(skipTraces)}
                <span className="ml-2 text-base font-medium text-white/60">traces</span>
              </p>
              <p className="mt-1 text-xs text-white/60">≈ {fmtMoney(balance)} credit · {fmtMoney(RATE_PER_TRACE)} per trace</p>
            </div>
          )}

          {stage === 'success' && (
            <div className="relative mt-6 flex flex-col items-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20">
                <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="mt-3 text-xl font-bold text-white">Payment Successful!</p>
              <p className="mt-1 text-sm text-white/70">{fmtTraces(skipTraces)} skip traces ready to use.</p>
            </div>
          )}

          {(stage === 'confirm' || stage === 'elements') && (
            <div className="relative mt-5">
              <p className="text-sm font-medium text-white/60">Buying</p>
              <p className="mt-1 text-4xl font-bold text-white">{fmtTraces(traces)} <span className="text-lg font-semibold text-white/70">traces</span></p>
              <p className="mt-1 text-sm text-white/70">{fmtMoney(traces * RATE_PER_TRACE)}</p>
            </div>
          )}
        </div>

        {/* ── Tabs (only on select stage) ── */}
        {stage === 'select' && (
          <div className="flex gap-1 bg-white px-5 py-3 shadow-sm">
            <TabPill label="Buy Traces"   icon={<PlusIcon />} active={tab === 'add'} onClick={() => setTab('add')} />
            <TabPill label="Transactions" icon={<ListIcon />} active={tab === 'tx'}  onClick={() => setTab('tx')}  />
          </div>
        )}

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto">
          {stage === 'success' ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-gray-400 animate-pulse">Loading transactions…</p>
            </div>
          ) : stage === 'confirm' ? (
            <ConfirmView
              traces={traces}
              card={card}
              onConfirm={handleSavedCardCharge}
            />
          ) : stage === 'elements' ? (
            <ElementsView
              traces={traces}
              clientSecret={clientSecret}
              onSuccess={handleElementsSuccess}
            />
          ) : tab === 'add' ? (
            <BuyTracesView onPick={handlePackagePicked} />
          ) : (
            <TransactionsView />
          )}
        </div>
      </aside>
    </>
  );
}

/* ── Tab pill ── */
function TabPill({ label, icon, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all duration-200 ${
        active
          ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
          : 'text-gray-500 hover:bg-gray-100'
      }`}
    >
      <span className={`h-4 w-4 ${active ? 'text-white' : 'text-gray-400'}`}>{icon}</span>
      {label}
    </button>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-full w-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}
function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-full w-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h10" />
    </svg>
  );
}

/* ============================================================================
   Buy Traces — packages + custom amount
============================================================================ */
function BuyTracesView({ onPick }) {
  const [selected, setSelected] = useState(null);   // package traces or 'custom'
  const [custom, setCustom]     = useState('');
  const [error, setError]       = useState('');
  const [busy, setBusy]         = useState(false);

  const customNum = parseInt(custom, 10);
  const isCustom  = selected === 'custom';
  const finalTraces = isCustom ? customNum : selected;
  const valid =
    Number.isInteger(finalTraces) &&
    finalTraces >= MIN_TRACES &&
    finalTraces <= MAX_TRACES;

  const submit = async (e) => {
    e.preventDefault();
    if (!valid) {
      setError(
        !Number.isInteger(finalTraces) || finalTraces < MIN_TRACES
          ? `Minimum is ${MIN_TRACES} skip traces.`
          : `Maximum is ${fmtTraces(MAX_TRACES)} skip traces per purchase.`,
      );
      return;
    }
    setError(''); setBusy(true);
    try {
      await onPick(finalTraces);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Could not start payment.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex h-full flex-col px-5 pb-8 pt-6">
      {/* Packages */}
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">Choose a package</p>
      <div className="grid grid-cols-2 gap-2.5">
        {PACKAGES.map((p) => {
          const sel = selected === p.traces;
          return (
            <button
              key={p.traces}
              type="button"
              onClick={() => { setSelected(p.traces); setCustom(''); setError(''); }}
              className={`rounded-2xl p-4 text-left transition-all duration-200 ${
                sel
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-200 scale-[1.02]'
                  : 'bg-white text-gray-800 shadow-sm ring-1 ring-gray-100 hover:ring-blue-300'
              }`}
            >
              <div className="flex items-start justify-between gap-1">
                <p className="text-2xl font-bold leading-none">{fmtTraces(p.traces)}</p>
                {p.popular && (
                  <span className={`shrink-0 flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    sel ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-600'
                  }`}>
                    <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    Popular
                  </span>
                )}
              </div>
              <p className={`text-xs mt-0.5 ${sel ? 'text-white/70' : 'text-gray-400'}`}>skip traces</p>
              <p className={`mt-3 text-base font-semibold ${sel ? 'text-white' : 'text-gray-700'}`}>
                {fmtMoney(p.traces * RATE_PER_TRACE)}
              </p>
            </button>
          );
        })}
      </div>

      {/* Custom amount */}
      <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
        <button
          type="button"
          onClick={() => { setSelected('custom'); setError(''); }}
          className={`w-full text-left ${isCustom ? '' : 'opacity-90'}`}
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Custom amount</p>
        </button>
        <div className="mt-2 flex items-end gap-3">
          <div className="relative flex-1">
            <input
              type="number"
              min={MIN_TRACES}
              max={MAX_TRACES}
              step="50"
              placeholder={String(MIN_TRACES)}
              value={custom}
              onFocus={() => setSelected('custom')}
              onChange={(e) => { setCustom(e.target.value); setSelected('custom'); setError(''); }}
              className="w-full border-0 bg-transparent pr-2 text-3xl font-bold text-gray-900 placeholder-gray-200 outline-none focus:ring-0"
            />
            <div className="h-px bg-gradient-to-r from-blue-400 via-blue-400 to-blue-400" />
            <p className="mt-1 text-xs text-gray-400">
              Min {fmtTraces(MIN_TRACES)} · Max {fmtTraces(MAX_TRACES)} traces
            </p>
          </div>
          {isCustom && Number.isInteger(customNum) && customNum > 0 && (
            <p className="pb-3 text-base font-semibold text-gray-700">
              {fmtMoney(customNum * RATE_PER_TRACE)}
            </p>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      <div className="mt-auto pt-8">
        <button
          type="submit"
          disabled={busy || !valid}
          className={`group relative w-full overflow-hidden rounded-2xl py-4 text-base font-bold text-white shadow-lg transition-all duration-200 disabled:opacity-40 ${
            valid ? 'bg-gradient-to-r from-blue-600 to-blue-700 shadow-blue-200 hover:shadow-xl hover:scale-[1.01]' : 'bg-gray-400'
          }`}
        >
          <span className="relative z-10 flex items-center justify-center gap-2">
            {busy ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Preparing…
              </>
            ) : valid ? (
              <>Continue · {fmtMoney(finalTraces * RATE_PER_TRACE)} →</>
            ) : (
              <>Pick a package</>
            )}
          </span>
        </button>
        <p className="mt-3 text-center text-xs text-gray-400">
          Secured by <span className="font-semibold text-gray-500">Stripe</span>
        </p>
      </div>
    </form>
  );
}

/* ============================================================================
   Confirm — saved card one-click charge
============================================================================ */
function ConfirmView({ traces, card, onConfirm }) {
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState('');
  const amount = traces * RATE_PER_TRACE;

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      await onConfirm();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Payment failed.');
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex h-full flex-col px-5 pb-8 pt-6">
      {/* Summary card */}
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <span className="text-sm text-gray-500">Skip traces</span>
          <span className="text-sm font-semibold text-gray-900">{fmtTraces(traces)}</span>
        </div>
        <div className="flex items-center justify-between border-b border-gray-100 py-3">
          <span className="text-sm text-gray-500">Rate</span>
          <span className="text-sm text-gray-700">{fmtMoney(RATE_PER_TRACE)} / trace</span>
        </div>
        <div className="flex items-center justify-between pt-3">
          <span className="text-base font-semibold text-gray-900">Total</span>
          <span className="text-2xl font-bold text-gray-900">{fmtMoney(amount)}</span>
        </div>
      </div>

      {/* Saved card */}
      <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Paying with</p>
        <div className="mt-2 flex items-center gap-3">
          <div className="flex h-10 w-14 items-center justify-center rounded-lg bg-gradient-to-br from-gray-800 to-gray-700 text-[10px] font-bold uppercase tracking-wider text-white">
            {card?.brand || 'Card'}
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">•••• {card?.last4 || '••••'}</p>
            <p className="text-xs text-gray-400">
              Exp {String(card?.exp_month ?? '').padStart(2, '0')}/{String(card?.exp_year ?? '').slice(-2)}
            </p>
          </div>
          <a
            href="/settings"
            className="text-xs font-semibold text-blue-600 hover:text-blue-700"
          >
            Change
          </a>
        </div>
      </div>

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      <div className="mt-auto pt-8">
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 py-4 text-base font-bold text-white shadow-lg shadow-blue-200 transition-all duration-200 hover:shadow-xl hover:scale-[1.01] disabled:opacity-40"
        >
          <span className="flex items-center justify-center gap-2">
            {busy ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Charging card…
              </>
            ) : (
              <>Charge {fmtMoney(amount)}</>
            )}
          </span>
        </button>
        <p className="mt-3 text-center text-xs text-gray-400">
          Your saved card will be charged immediately.
        </p>
      </div>
    </form>
  );
}

/* ============================================================================
   Elements — collect a new card (no saved card path)
============================================================================ */
function ElementsView({ traces, clientSecret, onSuccess }) {
  if (!stripePromise) {
    return (
      <div className="m-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
        Payments are not configured. Please contact support.
      </div>
    );
  }
  if (!clientSecret) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-gray-400 animate-pulse">Preparing checkout…</p>
      </div>
    );
  }

  const options = useMemo(
    () => ({
      clientSecret,
      appearance: {
        theme: 'stripe',
        variables: {
          colorPrimary: '#2563eb',
          borderRadius: '12px',
          fontSizeBase: '14px',
        },
      },
    }),
    [clientSecret],
  );

  return (
    <Elements stripe={stripePromise} options={options}>
      <ElementsForm traces={traces} onSuccess={onSuccess} />
    </Elements>
  );
}

function ElementsForm({ traces, onSuccess }) {
  const stripe   = useStripe();
  const elements = useElements();
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState('');
  const amount = traces * RATE_PER_TRACE;

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
        setError('Payment succeeded but confirmation failed. Please contact support.');
        setBusy(false);
      }
    } else {
      setError('Payment was not completed.');
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex h-full flex-col px-5 pb-8 pt-6">
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
        <PaymentElement
          options={{
            layout: { type: 'accordion', defaultCollapsed: false, radios: true, spacedAccordionItems: true },
            fields: { billingDetails: 'auto' },
            terms: { card: 'never', usBankAccount: 'never', link: 'never' },
          }}
        />
      </div>

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      <div className="mt-auto pt-8">
        <button
          type="submit"
          disabled={!stripe || busy}
          className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 py-4 text-base font-bold text-white shadow-lg shadow-blue-200 transition-all duration-200 hover:shadow-xl hover:scale-[1.01] disabled:opacity-40"
        >
          <span className="flex items-center justify-center gap-2">
            {busy ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Processing…
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Pay {fmtMoney(amount)}
              </>
            )}
          </span>
        </button>
        <p className="mt-3 text-center text-xs text-gray-400">
          Payments processed securely by <span className="font-semibold text-gray-500">Stripe</span>
        </p>
      </div>
    </form>
  );
}

/* ============================================================================
   Transactions tab
============================================================================ */
function TransactionsView() {
  const [txs, setTxs]     = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getTransactions()
      .then(setTxs)
      .catch(() => setError('Could not load transactions.'));
  }, []);

  if (error) {
    return (
      <div className="m-5 flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {error}
      </div>
    );
  }

  if (!txs) {
    return (
      <div className="flex flex-col gap-3 px-5 pt-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex animate-pulse items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
            <div className="h-10 w-10 shrink-0 rounded-full bg-gray-100" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-2/3 rounded-full bg-gray-100" />
              <div className="h-2.5 w-1/3 rounded-full bg-gray-100" />
            </div>
            <div className="h-3 w-14 rounded-full bg-gray-100" />
          </div>
        ))}
      </div>
    );
  }

  if (!txs.length) {
    return (
      <div className="flex flex-col items-center justify-center px-8 py-20 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-50">
          <svg className="h-10 w-10 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
          </svg>
        </div>
        <p className="mt-4 text-base font-semibold text-gray-700">No transactions yet</p>
        <p className="mt-1.5 text-sm leading-relaxed text-gray-400">
          Your purchases and skip-trace<br />charges will appear here.
        </p>
      </div>
    );
  }

  const groups = txs.reduce((acc, tx) => {
    const day = new Date(tx.created_at).toLocaleDateString(undefined, {
      month: 'long', day: 'numeric', year: 'numeric',
    });
    if (!acc[day]) acc[day] = [];
    acc[day].push(tx);
    return acc;
  }, {});

  const tracesFor = (tx) => Math.round(Math.abs(Number(tx.amount)) / RATE_PER_TRACE);

  return (
    <div className="space-y-5 px-5 pb-8 pt-4">
      {Object.entries(groups).map(([day, items]) => (
        <div key={day}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400">{day}</p>
          <div className="space-y-2">
            {items.map((tx) => {
              const isCredit = tx.amount > 0;
              const traces   = tracesFor(tx);
              return (
                <div
                  key={tx.id}
                  className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100 transition-shadow hover:shadow-md"
                >
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                    isCredit ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                  }`}>
                    {isCredit ? (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
                      </svg>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {tx.description || labelFor(tx.type)}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(tx.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                      {' · '}
                      <span className={`font-medium ${
                        tx.status === 'succeeded' ? 'text-emerald-500' : tx.status === 'failed' ? 'text-rose-500' : 'text-amber-500'
                      }`}>
                        {tx.status}
                      </span>
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`text-sm font-bold ${isCredit ? 'text-emerald-600' : 'text-gray-800'}`}>
                      {isCredit ? '+' : '-'}{fmtTraces(traces)}
                    </p>
                    <p className="text-xs text-gray-400">
                      {isCredit ? '+' : '-'}{fmtMoney(Math.abs(Number(tx.amount)))}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function labelFor(type) {
  return { top_up: 'Skip traces purchase', charge: 'Skip trace', refund: 'Refund' }[type] || type;
}
