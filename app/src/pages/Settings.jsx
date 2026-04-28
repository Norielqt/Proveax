import { useEffect, useMemo, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useAuth } from '../context/AuthContext';
import { updateProfile } from '../api/auth';
import {
  listPaymentMethods,
  createSetupIntent,
  setDefaultPaymentMethod,
  deletePaymentMethod,
} from '../api/paymentMethods';

const stripeKey     = import.meta.env.VITE_STRIPE_KEY;
const stripePromise = stripeKey ? loadStripe(stripeKey) : null;

export default function Settings() {
  const { user, refresh } = useAuth();
  const [name, setName]       = useState(user?.name ?? '');
  const [saving, setSaving]   = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError]     = useState('');

  /* ── Payment methods state ─────────────────────────────────────────── */
  const [methods, setMethods]     = useState([]);
  const [pmLoading, setPmLoading] = useState(true);
  const [pmError, setPmError]     = useState('');
  const [busyId, setBusyId]       = useState(null);
  const [addOpen, setAddOpen]     = useState(false);

  const loadMethods = async () => {
    setPmLoading(true);
    setPmError('');
    try {
      const r = await listPaymentMethods();
      setMethods(r.data ?? []);
    } catch (e) {
      setPmError(e?.response?.data?.message || 'Failed to load payment methods.');
    } finally {
      setPmLoading(false);
    }
  };

  useEffect(() => { loadMethods(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setSuccess(false);
    setError('');
    try {
      await updateProfile({ name: name.trim() });
      await refresh();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const handleSetDefault = async (id) => {
    setBusyId(id);
    try {
      await setDefaultPaymentMethod(id);
      await loadMethods();
    } catch (e) {
      setPmError(e?.response?.data?.message || 'Failed to set default.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this card?')) return;
    setBusyId(id);
    try {
      await deletePaymentMethod(id);
      await loadMethods();
    } catch (e) {
      setPmError(e?.response?.data?.message || 'Failed to remove card.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
      <p className="text-sm text-gray-500 mt-1 mb-8">Manage your account information and payment preferences.</p>

      {/* My Profile */}
      <section className="mb-6 px-5">
        <h2 className="text-base font-semibold text-gray-800">My Profile</h2>
        <p className="text-sm text-gray-500 mt-0.5 mb-3">Update your display name.</p>
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
            <div>
              <label htmlFor="settings-name" className="block text-sm font-medium text-gray-700 mb-1.5">
                Name
              </label>
              <input
                id="settings-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                placeholder="Your name"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={user?.email ?? ''}
                readOnly
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-500 cursor-not-allowed select-all"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {success && <p className="text-sm text-green-600">Profile updated successfully.</p>}

            <div className="border-t border-gray-100 -mx-6 px-6 pt-4 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setName(user?.name ?? '')}
                className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-4 focus:ring-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !name.trim()}
                className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* Payment Methods */}
      <section className="mt-16 px-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Payment Methods</h2>
            <p className="text-sm text-gray-500 mt-0.5">Manage cards used for wallet top-ups and subscriptions.</p>
          </div>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500/20 transition-colors"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add new card
          </button>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          {pmError && (
            <div className="border-b border-red-100 bg-red-50 px-6 py-3 text-sm text-red-700">{pmError}</div>
          )}

          {pmLoading ? (
            <div className="px-6 py-10 text-center text-sm text-gray-500">Loading payment methods…</div>
          ) : methods.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                <svg className="h-6 w-6 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <rect x="2" y="6" width="20" height="14" rx="2" />
                  <path strokeLinecap="round" d="M2 10h20" />
                </svg>
              </div>
              <p className="mt-3 text-sm font-medium text-gray-700">No saved cards yet</p>
              <p className="text-xs text-gray-500 mt-1">Add a card to make wallet top-ups and subscription payments faster.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {methods.map((m) => (
                <li key={m.id} className="flex items-center gap-4 px-6 py-4">
                  <CardBrandIcon brand={m.brand} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-800 capitalize">{m.brand}</span>
                      <span className="text-sm text-gray-500">•••• {m.last4}</span>
                      {m.is_default && (
                        <span className="ml-1 inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700 ring-1 ring-blue-200">
                          Default
                        </span>
                      )}
                    </div>
                    {m.exp_month && m.exp_year && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        Expires {String(m.exp_month).padStart(2, '0')}/{String(m.exp_year).slice(-2)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {!m.is_default && (
                      <button
                        onClick={() => handleSetDefault(m.id)}
                        disabled={busyId === m.id}
                        className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                      >
                        Set default
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(m.id)}
                      disabled={busyId === m.id}
                      className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 hover:border-red-200 disabled:opacity-50 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Add card modal */}
      {addOpen && (
        <AddCardModal
          onClose={() => setAddOpen(false)}
          onAdded={async () => { setAddOpen(false); await loadMethods(); }}
        />
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function CardBrandIcon({ brand }) {
  const label = (brand || '').slice(0, 4).toUpperCase();
  const bg = {
    visa:       'bg-[#1a1f71]',
    mastercard: 'bg-[#eb001b]',
    amex:       'bg-[#2e77bb]',
    discover:   'bg-[#ff6000]',
  }[brand] || 'bg-gray-700';
  return (
    <div className={`flex h-9 w-14 shrink-0 items-center justify-center rounded-md ${bg} text-[10px] font-extrabold tracking-wider text-white shadow-sm`}>
      {label}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function AddCardModal({ onClose, onAdded }) {
  const [clientSecret, setClientSecret] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await createSetupIntent();
        if (!cancelled) setClientSecret(r.client_secret);
      } catch (e) {
        if (!cancelled) setErr(e?.response?.data?.message || 'Could not start card setup.');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const options = useMemo(
    () => clientSecret ? {
      clientSecret,
      appearance: {
        theme: 'stripe',
        variables: { colorPrimary: '#2563eb', borderRadius: '10px', fontSizeBase: '14px' },
      },
    } : null,
    [clientSecret],
  );

  return (
    <div className="fixed inset-0 z-[1400] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h3 className="text-base font-semibold text-gray-900">Add a new card</h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6">
          {err && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{err}</div>}
          {!stripePromise && (
            <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Payments are not configured. Set <code>VITE_STRIPE_KEY</code> in the frontend env.
            </div>
          )}
          {stripePromise && !clientSecret && !err && (
            <p className="text-sm text-gray-500">Preparing secure form…</p>
          )}
          {stripePromise && options && (
            <Elements stripe={stripePromise} options={options}>
              <AddCardForm onAdded={onAdded} onCancel={onClose} />
            </Elements>
          )}
        </div>
      </div>
    </div>
  );
}

function AddCardForm({ onAdded, onCancel }) {
  const stripe   = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setErr('');
    const { error } = await stripe.confirmSetup({
      elements,
      confirmParams: { return_url: window.location.origin + '/settings' },
      redirect: 'if_required',
    });
    if (error) {
      setErr(error.message || 'Could not save card.');
      setBusy(false);
      return;
    }
    setBusy(false);
    onAdded?.();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement options={{ layout: 'tabs' }} />
      {err && <p className="text-sm text-red-600">{err}</p>}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!stripe || busy}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {busy ? 'Saving…' : 'Save card'}
        </button>
      </div>
    </form>
  );
}
