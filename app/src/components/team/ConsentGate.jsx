import { useEffect, useState } from 'react';
import { getTeamSettings, giveMonitoringConsent } from '../../api/team';
import { useAuth } from '../../context/AuthContext';

/**
 * Full-screen consent gate. Renders when the authed user has not yet
 * granted monitoring consent. Blocks the app until accepted.
 */
export default function ConsentGate({ children }) {
  const { user, refresh } = useAuth();
  const [settings, setSettings] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const needsConsent = !!user && !user.monitoring_consent_at;

  useEffect(() => {
    if (needsConsent) getTeamSettings().then(setSettings).catch(() => {});
  }, [needsConsent]);

  if (!needsConsent) return children;

  const accept = async () => {
    setSubmitting(true); setError(null);
    try {
      await giveMonitoringConsent();
      if (refresh) await refresh();
      else window.location.reload();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not record consent. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-8 shadow-xl">
        <h1 className="text-xl font-bold text-gray-900">Workplace monitoring notice</h1>
        <p className="mt-2 text-sm text-gray-500">
          Please review and accept before continuing. This is shown once.
        </p>

        <div className="mt-5 max-h-[40vh] overflow-y-auto whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
          {settings?.consent_text ?? 'Loading…'}
        </div>

        {error && (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </div>
        )}

        <div className="mt-6 flex items-center justify-between gap-3">
          <p className="text-xs text-gray-400">
            If you do not agree, log out and contact your administrator.
          </p>
          <button
            onClick={accept}
            disabled={submitting || !settings}
            className="rounded-md bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Saving…' : 'I understand & accept'}
          </button>
        </div>
      </div>
    </div>
  );
}
