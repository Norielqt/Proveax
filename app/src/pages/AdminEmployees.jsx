import { useEffect, useState } from 'react';
import { listInvites, createInvite } from '../api/invites';

export default function AdminEmployees() {
  const [invites, setInvites]   = useState([]);
  const [email, setEmail]       = useState('');
  const [inviteUrl, setInviteUrl] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  useEffect(() => { listInvites().then(setInvites); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setInviteUrl(''); setLoading(true);
    try {
      const result = await createInvite(email);
      setInviteUrl(result.invite_url);
      setEmail('');
      const inv = await listInvites();
      setInvites(inv);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create invite.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-8">
      <h1 className="text-2xl font-bold text-gray-900">Employees</h1>

      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="font-semibold text-gray-900">Invite a team member</h2>
        {error    && <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</div>}
        {inviteUrl && (
          <div className="mt-3 rounded-md bg-blue-50 p-3 text-sm">
            <div className="font-medium text-blue-900">Invite link created:</div>
            <div className="mt-1 break-all text-blue-800">{inviteUrl}</div>
          </div>
        )}
        <form onSubmit={submit} className="mt-3 flex gap-2">
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="employee@company.com"
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm" />
          <button disabled={loading}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {loading ? 'Creating…' : 'Invite'}
          </button>
        </form>
      </div>

      <div className="mt-6">
        <h2 className="font-semibold text-gray-900 mb-3">Invites sent</h2>
        {invites.length === 0
          ? <div className="text-sm text-gray-500">No invites sent yet.</div>
          : (
            <ul className="space-y-2">
              {invites.map((inv) => (
                <li key={inv.id} className="rounded-lg border border-gray-200 bg-white p-3 text-sm flex justify-between">
                  <span>{inv.email}</span>
                  <span className={`text-xs ${inv.accepted_at ? 'text-green-600' : 'text-gray-500'}`}>
                    {inv.accepted_at ? 'Accepted' : 'Pending'}
                  </span>
                </li>
              ))}
            </ul>
          )}
      </div>
    </div>
  );
}
