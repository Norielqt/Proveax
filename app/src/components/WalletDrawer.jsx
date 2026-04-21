import { useEffect, useMemo, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import {
  createTopUpIntent,
  confirmTopUp,
  getTransactions,
} from '../api/wallet';
import { useAuth } from '../context/AuthContext';

const stripeKey     = import.meta.env.VITE_STRIPE_KEY;
const stripePromise = stripeKey ? loadStripe(stripeKey) : null;

const PRESET_AMOUNTS = [10, 25, 50, 100];

/* ============================================================================
   Drawer shell
============================================================================ */
export default function WalletDrawer({ open, onClose }) {
  const { user, refresh } = useAuth();
  const [tab, setTab]     = useState('add');
  const [topUp, setTopUp] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => { setTab('add'); setTopUp(null); setSuccess(false); }, 350);
      return () => clearTimeout(t);
    }
  }, [open]);

  const handleAmountContinue = async (amount) => {
    const { client_secret } = await createTopUpIntent(amount);
    setTopUp({ amount, clientSecret: client_secret });
  };

  const handlePaymentSuccess = async (paymentIntentId) => {
    await confirmTopUp(paymentIntentId);
    await refresh();
    setSuccess(true);
    setTimeout(() => { setTopUp(null); setSuccess(false); setTab('tx'); }, 2200);
  };

  const showPayView = topUp !== null && !success;
  const balance = Number(user?.balance ?? 0);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-[1300] transition-all duration-300 ${
          open ? 'bg-black/50 backdrop-blur-sm' : 'pointer-events-none bg-transparent'
        }`}
      />

      {/* Drawer */}
      <aside
        className={`fixed right-0 top-0 z-[1301] flex h-full w-full max-w-[420px] flex-col bg-[#f8f9fc] shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* ── Hero header ── */}
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-blue-700 px-6 pb-8 pt-5">
          {/* decorative circles */}
          <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-14 -left-6 h-44 w-44 rounded-full bg-white/5" />
          <div className="pointer-events-none absolute bottom-4 right-16 h-20 w-20 rounded-full bg-white/10" />

          {/* close & back */}
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-2">
              {showPayView && (
                <button
                  onClick={() => setTopUp(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 transition-colors"
                  aria-label="Back"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}
              <span className="text-xs font-semibold uppercase tracking-widest text-white/60">
                {showPayView ? 'Checkout' : 'Proveax Wallet'}
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

          {/* balance display */}
          {!showPayView && !success && (
            <div className="relative mt-5">
              <p className="text-sm font-medium text-white/60">Available balance</p>
              <p className="mt-1 text-5xl font-bold tracking-tight text-white">
                <span className="text-2xl font-semibold text-white/70 align-top mt-2 inline-block mr-1">$</span>
                {balance.toFixed(2)}
              </p>
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white/80">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Account active
              </div>
            </div>
          )}

          {/* success state */}
          {success && (
            <div className="relative mt-6 flex flex-col items-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20">
                <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="mt-3 text-xl font-bold text-white">Payment Successful!</p>
              <p className="mt-1 text-sm text-white/70">Your wallet has been topped up.</p>
            </div>
          )}

          {/* pay header balance preview */}
          {showPayView && (
            <div className="relative mt-5">
              <p className="text-sm font-medium text-white/60">Adding to wallet</p>
              <p className="mt-1 text-4xl font-bold text-white">${Number(topUp.amount).toFixed(2)}</p>
            </div>
          )}
        </div>

        {/* ── Tabs (only on non-pay view) ── */}
        {!showPayView && !success && (
          <div className="flex gap-1 bg-white px-5 py-3 shadow-sm">
            <TabPill label="Add Money" icon={<PlusIcon />} active={tab === 'add'} onClick={() => setTab('add')} />
            <TabPill label="Transactions" icon={<ListIcon />} active={tab === 'tx'}  onClick={() => setTab('tx')}  />
          </div>
        )}

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto">
          {success ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-gray-400 animate-pulse">Redirecting to transactions…</p>
            </div>
          ) : showPayView ? (
            <PayView
              amount={topUp.amount}
              clientSecret={topUp.clientSecret}
              onSuccess={handlePaymentSuccess}
            />
          ) : tab === 'add' ? (
            <AddMoneyView onContinue={handleAmountContinue} />
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

/* ── Inline SVG icons ── */
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
   Add Money tab
============================================================================ */
function AddMoneyView({ onContinue }) {
  const [amount, setAmount] = useState('');
  const [error, setError]   = useState('');
  const [busy, setBusy]     = useState(false);

  const numVal = parseFloat(amount);
  const valid  = !isNaN(numVal) && numVal >= 5 && numVal <= 2000;

  const submit = async (e) => {
    e.preventDefault();
    if (!valid) return setError(isNaN(numVal) || numVal < 5 ? 'Minimum top-up is $5.' : 'Maximum top-up is $2,000.');
    setError(''); setBusy(true);
    try {
      await onContinue(numVal);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not start payment.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex h-full flex-col px-5 pb-8 pt-6">
      {/* Amount input card */}
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
        <label className="block text-xs font-semibold uppercase tracking-widest text-gray-400">
          Enter amount
        </label>
        <div className="relative mt-3 flex items-center">
          <span className="pointer-events-none absolute left-0 text-3xl font-bold text-gray-300">$</span>
          <input
            type="number"
            min="5"
            max="2000"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => { setAmount(e.target.value); setError(''); }}
            className="w-full border-0 bg-transparent pl-7 text-4xl font-bold text-gray-900 placeholder-gray-200 outline-none focus:ring-0"
            required
          />
        </div>
        <div className="mt-1 h-px bg-gradient-to-r from-blue-400 via-blue-400 to-blue-400" />
        <p className="mt-2 text-xs text-gray-400">Min $5 · Max $2,000</p>
      </div>

      {/* Preset chips */}
      <div className="mt-4 grid grid-cols-4 gap-2.5">
        {PRESET_AMOUNTS.map((n) => {
          const sel = Number(amount) === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => { setAmount(String(n)); setError(''); }}
              className={`relative overflow-hidden rounded-xl py-3 text-sm font-bold transition-all duration-200 ${
                sel
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-200 scale-[1.04]'
                  : 'bg-white text-gray-700 shadow-sm ring-1 ring-gray-100 hover:ring-blue-300 hover:text-blue-600'
              }`}
            >
              ${n}
            </button>
          );
        })}
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
          disabled={busy || !amount}
          className={`group relative w-full overflow-hidden rounded-2xl py-4 text-base font-bold text-white shadow-lg transition-all duration-200 disabled:opacity-40 ${
            valid ? 'bg-gradient-to-r from-blue-600 to-blue-700 shadow-blue-200 hover:shadow-xl hover:shadow-blue-200 hover:scale-[1.01]' : 'bg-gray-400'
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
            ) : (
              <>Continue to payment →</>
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
   Pay — Stripe Elements
============================================================================ */
function PayView({ amount, clientSecret, onSuccess }) {
  if (!stripePromise) {
    return (
      <div className="m-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
        Payments are not configured. Please contact support.
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
      <PayForm amount={amount} onSuccess={onSuccess} />
    </Elements>
  );
}

function PayForm({ amount, onSuccess }) {
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
          className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 py-4 text-base font-bold text-white shadow-lg shadow-blue-200 transition-all duration-200 hover:shadow-xl hover:shadow-blue-200 hover:scale-[1.01] disabled:opacity-40"
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
                Pay ${Number(amount).toFixed(2)}
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
          Your payments and charges will<br />appear here once you add funds.
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

  return (
    <div className="space-y-5 px-5 pb-8 pt-4">
      {Object.entries(groups).map(([day, items]) => (
        <div key={day}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400">{day}</p>
          <div className="space-y-2">
            {items.map((tx) => {
              const isCredit = tx.amount > 0;
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
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
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
                      {isCredit ? '+' : '-'}${Math.abs(Number(tx.amount)).toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-400">${Number(tx.balance_after).toFixed(2)}</p>
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
  return { top_up: 'Add money', charge: 'Charge', refund: 'Refund' }[type] || type;
}

