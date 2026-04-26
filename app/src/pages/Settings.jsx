import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { updateProfile } from '../api/auth';

export default function Settings() {
  const { user, tenant, refresh } = useAuth();
  const [name, setName]       = useState(user?.name ?? '');
  const [saving, setSaving]   = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError]     = useState('');

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
            {/* Name */}
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

            {/* Email — read-only */}
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

            {/* Feedback */}
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
            {success && (
              <p className="text-sm text-green-600">Profile updated successfully.</p>
            )}

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
      <section className="px-5">
        <h2 className="text-base font-semibold text-gray-800">Payment Methods</h2>
        <p className="text-sm text-gray-500 mt-0.5 mb-3">Manage how you fund your Proveax wallet.</p>
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-5">
            <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5">
              {/* Card icon */}
              <div className="flex h-9 w-14 shrink-0 items-center justify-center rounded-md border border-gray-300 bg-white shadow-sm">
                <svg className="h-5 w-8 text-gray-500" viewBox="0 0 32 20" fill="none">
                  <rect width="32" height="20" rx="3" fill="#E5E7EB" />
                  <rect y="5" width="32" height="5" fill="#9CA3AF" />
                  <rect x="4" y="13" width="8" height="2.5" rx="1" fill="#6B7280" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-800">Bank Card</p>
                <p className="text-xs text-gray-500 mt-0.5">Add a card via the wallet top-up flow.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
