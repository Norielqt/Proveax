import { useEffect, useState } from 'react';
import { listInvites, createInvite, resendInvite, revokeInvite } from '../api/invites';

const STATUS_STYLES = {
  pending:  'bg-amber-50 text-amber-700 border-amber-200',
  accepted: 'bg-green-50 text-green-700 border-green-200',
  expired:  'bg-gray-100 text-gray-500 border-gray-200',
  revoked:  'bg-red-50 text-red-700 border-red-200',
};

export default function AdminEmployees() {
  const [invites, setInvites]     = useState([]);
  const [email, setEmail]         = useState('');
  const [role, setRole]           = useState('employee');
  const [notice, setNotice]       = useState(null); // { type, text }
  const [loading, setLoading]     = useState(false);
  const [actionId, setActionId]   = useState(null); // row-level pending id

  const refresh = () => listInvites().then(setInvites);

  useEffect(() => { refresh(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setNotice(null); setLoading(true);
    try {
      const result = await createInvite(email, role);
      setNotice({
        type: 'success',
        text: result.email_sent
          ? `Invitation email sent to ${result.invite.email}.`
          : `Invite created, but email failed. Copy the link: ${result.invite_url}`,
      });
      setEmail('');
      await refresh();
    } catch (err) {
      setNotice({ type: 'error', text: err.response?.data?.message || 'Failed to create invite.' });
    } finally {
      setLoading(false);
    }
  };

  const doResend = async (id) => {
    setActionId(id); setNotice(null);
    try {
      const result = await resendInvite(id);
      setNotice({
        type: 'success',
        text: result.email_sent
          ? `Invitation resent to ${result.invite.email}.`
          : `Token refreshed, but email failed. Copy link: ${result.invite_url}`,
      });
      await refresh();
    } catch (err) {
      setNotice({ type: 'error', text: err.response?.data?.message || 'Failed to resend.' });
    } finally {
      setActionId(null);
    }
  };

  const doRevoke = async (id) => {
    if (!confirm('Revoke this invitation? The link will stop working immediately.')) return;
    setActionId(id); setNotice(null);
    try {
      await revokeInvite(id);
      await refresh();
    } catch (err) {
      setNotice({ type: 'error', text: err.response?.data?.message || 'Failed to revoke.' });
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8">
      <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
      <p className="mt-1 text-sm text-gray-500">Invite team members to join your workspace.</p>

      {/* Invite form */}
      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="font-semibold text-gray-900">Send an invitation</h2>

        {notice && (
          <div className={`mt-3 rounded-md border px-3 py-2 text-sm ${
            notice.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}>
            {notice.text}
          </div>
        )}

        <form onSubmit={submit} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="employee@company.com"
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20"
          >
            <option value="employee">Employee</option>
            <option value="admin">Admin</option>
          </select>
          <button
            disabled={loading}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Sending…' : 'Send invite'}
          </button>
        </form>
        <p className="mt-2 text-xs text-gray-400">
          An email will be sent with a link valid for 7 days. The invitee sets their own password on acceptance.
        </p>
      </div>

      {/* Invites list */}
      <div className="mt-6">
        <h2 className="mb-3 font-semibold text-gray-900">Invitations</h2>
        {invites.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
            No invitations yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Email</th>
                  <th className="px-4 py-2 font-medium">Role</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Invited by</th>
                  <th className="px-4 py-2 font-medium">Sent</th>
                  <th className="px-4 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invites.map((inv) => {
                  const status = inv.status ?? (inv.accepted_at ? 'accepted' : 'pending');
                  const canAct = status === 'pending' || status === 'expired';
                  return (
                    <tr key={inv.id} className="text-gray-700">
                      <td className="px-4 py-2.5">{inv.email}</td>
                      <td className="px-4 py-2.5 capitalize">{inv.role ?? 'employee'}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[status] ?? STATUS_STYLES.pending}`}>
                          {status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-500">
                        {inv.invited_by?.name ?? '—'}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-500">
                        {inv.created_at ? new Date(inv.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {canAct && (
                          <div className="inline-flex gap-2">
                            <button
                              onClick={() => doResend(inv.id)}
                              disabled={actionId === inv.id}
                              className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                            >
                              Resend
                            </button>
                            <button
                              onClick={() => doRevoke(inv.id)}
                              disabled={actionId === inv.id}
                              className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                            >
                              Revoke
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
