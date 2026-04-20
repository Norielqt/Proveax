import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getSubscriptionStatus, startCheckout } from '../api/subscription';

export default function Billing() {
  const { tenant } = useAuth();
  const [status, setStatus]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    getSubscriptionStatus()
      .then(setStatus)
      .finally(() => setLoading(false));
  }, []);

  const handleUpgrade = async () => {
    setChecking(true);
    try {
      const { url } = await startCheckout();
      window.location.href = url;
    } catch {
      setChecking(false);
    }
  };

  if (loading) return <div className="p-8">Loading…</div>;

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-8">
      <h1 className="text-2xl font-bold text-gray-900">Billing</h1>

      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-500">Current status</div>
            <div className="mt-1 text-lg font-semibold capitalize">{status?.status || '—'}</div>
          </div>
          {status?.trial_ends_at && (
            <div className="text-right">
              <div className="text-sm text-gray-500">Trial ends</div>
              <div className="font-medium">{new Date(status.trial_ends_at).toLocaleDateString()}</div>
              {status.days_left !== null && (
                <div className="text-sm text-gray-500">{status.days_left} day{status.days_left === 1 ? '' : 's'} left</div>
              )}
            </div>
          )}
        </div>

        {!status?.is_active && (
          <button onClick={handleUpgrade} disabled={checking}
            className="mt-6 w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            {checking ? 'Redirecting to checkout…' : 'Upgrade to paid plan'}
          </button>
        )}
        {status?.is_active && (
          <div className="mt-4 rounded-md bg-green-50 p-3 text-sm text-green-800">
            ✓ You have an active subscription.
          </div>
        )}
      </div>
    </div>
  );
}
