import { useEffect, useState } from 'react';
import { listInvites, createInvite, resendInvite, revokeInvite } from '../../api/invites';
import { listMembers, updateMemberRole, pauseMember, unpauseMember, removeMember } from '../../api/team';
import { useAuth } from '../../context/AuthContext';

const INVITE_STATUS = {
  pending:  'bg-amber-50 text-amber-700',
  accepted: 'bg-black/[0.05] text-[#5a5a55]',
  expired:  'bg-black/[0.04] text-[#888]',
  revoked:  'bg-black/[0.04] text-[#888]',
};

function Notice({ notice }) {
  if (!notice) return null;
  return (
    <div className={`mb-3 rounded-xl border px-3 py-2 text-sm ${
      notice.type === 'success'
        ? 'border-black/[0.06] bg-black/[0.05] text-[#111]'
        : 'border-black/[0.08] bg-[#fafafa] text-[#111]'
    }`}>
      {notice.text}
    </div>
  );
}

export default function Members() {
  const { user: me } = useAuth();
  const isAdmin = me?.role === 'admin';
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('employee');
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetchingMembers, setFetchingMembers] = useState(true);
  const [actionId, setActionId] = useState(null);

  const refresh = async () => {
    const [m, i] = await Promise.all([
      listMembers(),
      isAdmin ? listInvites() : Promise.resolve([]),
    ]);
    const sorted = [...m].sort((a, b) => {
      if (a.role === b.role) return a.name.localeCompare(b.name);
      return a.role === 'admin' ? -1 : 1;
    });
    setMembers(sorted); setInvites(i);
    setFetchingMembers(false);
  };

  useEffect(() => { refresh(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setNotice(null); setLoading(true);
    try {
      const r = await createInvite(email, role);
      setNotice({
        type: 'success',
        text: r.email_sent
          ? `Invitation email sent to ${r.invite.email}.`
          : `Invite created, but email failed. Copy: ${r.invite_url}`,
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
    setActionId(`inv-${id}`); setNotice(null);
    try {
      const r = await resendInvite(id);
      setNotice({
        type: 'success',
        text: r.email_sent ? `Invitation resent to ${r.invite.email}.` : `Token refreshed. Copy: ${r.invite_url}`,
      });
      await refresh();
    } catch (err) {
      setNotice({ type: 'error', text: err.response?.data?.message || 'Failed to resend.' });
    } finally { setActionId(null); }
  };

  const doRevoke = async (id) => {
    if (!confirm('Revoke this invitation?')) return;
    setActionId(`inv-${id}`);
    try { await revokeInvite(id); await refresh(); }
    catch (err) { setNotice({ type: 'error', text: err.response?.data?.message || 'Failed.' }); }
    finally { setActionId(null); }
  };

  const doRoleChange = async (id, newRole) => {
    setActionId(`m-${id}`); setNotice(null);
    try { await updateMemberRole(id, newRole); await refresh(); }
    catch (err) { setNotice({ type: 'error', text: err.response?.data?.message || 'Failed.' }); }
    finally { setActionId(null); }
  };

  const doPause = async (id, paused) => {
    const verb = paused ? 'unpause' : 'pause';
    if (!confirm(`${paused ? 'Restore' : 'Pause'} this member? ${paused ? '' : 'They will be logged out.'}`)) return;
    setActionId(`m-${id}`); setNotice(null);
    try {
      if (paused) await unpauseMember(id);
      else await pauseMember(id);
      await refresh();
    } catch (err) {
      setNotice({ type: 'error', text: err.response?.data?.message || `Failed to ${verb}.` });
    } finally { setActionId(null); }
  };

  const doRemove = async (id, name) => {
    if (!confirm(`Remove ${name}? Their historical data will remain but the account will be deleted.`)) return;
    setActionId(`m-${id}`); setNotice(null);
    try { await removeMember(id); await refresh(); }
    catch (err) { setNotice({ type: 'error', text: err.response?.data?.message || 'Failed.' }); }
    finally { setActionId(null); }
  };

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-[#111] leading-tight">Members</h1>
      <p className="mt-1 text-sm text-[#888]">Manage who has access to your workspace.</p>

      {/* Invite form — admin only */}
      {isAdmin && (
      <div className="mt-6 rounded-2xl border border-black/[0.06] bg-white p-5">
        <h2 className="font-semibold text-[#111]">Invite a new member</h2>
        <Notice notice={notice} />
        <form onSubmit={submit} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            required type="email" value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="employee@company.com"
            className="flex-1 rounded-xl border border-black/[0.09] bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-black/[0.06]"
          />
          <select
            value={role} onChange={(e) => setRole(e.target.value)}
            className="rounded-xl border border-black/[0.09] bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-black/[0.06]"
          >
            <option value="employee">Employee</option>
            <option value="admin">Admin</option>
          </select>
          <button
            disabled={loading}
            className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Sending…' : 'Send invite'}
          </button>
        </form>
        <p className="mt-2 text-xs text-[#aaa]">Invitation links are valid for 7 days.</p>
      </div>
      )}

      {/* Members list */}
      <h2 className="mt-8 mb-3 text-sm font-semibold text-[#111]">
        Team members {!fetchingMembers && `(${members.length})`}
      </h2>
      <div className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white">
        <table className="w-full table-fixed text-sm">
          <thead className="bg-[#fafafa] text-left text-[10px] uppercase tracking-[0.12em] text-[#888]">
            <tr>
              <th className="w-1/4 px-4 py-3 font-semibold">Name</th>
              <th className="w-1/4 px-4 py-3 font-semibold">Email</th>
              <th className="w-1/6 px-4 py-3 font-semibold">Role</th>
              <th className="w-1/6 px-4 py-3 font-semibold">Status</th>
              <th className="w-24 px-4 py-3 font-semibold"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.04]">
            {fetchingMembers
              ? Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-3">
                      <div className="h-3.5 w-32 rounded bg-black/[0.06]" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-3.5 w-44 rounded bg-black/[0.06]" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-3.5 w-16 rounded bg-black/[0.06]" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-5 w-14 rounded-full bg-black/[0.06]" />
                    </td>
                    <td className="px-4 py-3" />
                  </tr>
                ))
              : members.map((m) => {
              const isMe = m.id === me?.id;
              const busy = actionId === `m-${m.id}`;
              return (
                <tr key={m.id} className={`text-[#5a5a55] ${m.is_paused ? 'bg-[#fafafa]/60' : ''}`}>
                  <td className="px-4 py-2.5 font-medium">
                    {m.name} {isMe && <span className="ml-1 text-xs text-[#aaa]">(you)</span>}
                  </td>
                  <td className="px-4 py-2.5 text-[#5a5a55]">{m.email}</td>
                  <td className="px-4 py-2.5">
                    {isAdmin ? (
                      <select
                        value={m.role}
                        onChange={(e) => doRoleChange(m.id, e.target.value)}
                        disabled={isMe || busy}
                        className="rounded-2xl border border-black/[0.06] bg-white px-2 py-1 text-xs disabled:bg-[#f5f5f5] disabled:text-[#aaa]"
                      >
                        <option value="employee">Employee</option>
                        <option value="admin">Admin</option>
                      </select>
                    ) : (
                      <span className="capitalize text-xs text-[#5a5a55]">{m.role}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {m.is_paused ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-black/[0.05] px-2.5 py-0.5 text-xs font-medium text-[#5a5a55]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#888]" />
                        Paused
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-black/[0.05] px-2.5 py-0.5 text-xs font-medium text-[#5a5a55]">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {isAdmin && !isMe && (
                      <div className="inline-flex gap-2">
                        <button
                          onClick={() => doPause(m.id, m.is_paused)}
                          disabled={busy}
                          className="rounded-full border border-black/[0.06] px-2.5 py-1 text-xs font-medium text-[#5a5a55] hover:bg-[#fafafa] disabled:opacity-50"
                        >
                          {m.is_paused ? 'Restore' : 'Pause'}
                        </button>
                        <button
                          onClick={() => doRemove(m.id, m.name)}
                          disabled={busy}
                          className="rounded-full border border-black/[0.09] px-2.5 py-1 text-xs font-medium text-[#5a5a55] hover:bg-[#fafafa] disabled:opacity-50"
                        >
                          Remove
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

      {/* Pending invites */}
      {invites.length > 0 && (
        <>
          <h2 className="mt-8 mb-3 font-semibold text-[#111]">Invitations</h2>
          <div className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white">
            {(() => {
              const hasInvitedBy = invites.some((i) => i.invited_by?.name);
              const hasActions   = isAdmin && invites.some((i) => {
                const s = i.status ?? (i.accepted_at ? 'accepted' : 'pending');
                return s === 'pending' || s === 'expired';
              });
              return (
                <table className="w-full table-fixed text-sm">
                  <thead className="bg-[#fafafa] text-left text-[10px] uppercase tracking-[0.12em] text-[#888]">
                    <tr>
                      <th className="w-1/4 px-4 py-2 font-medium">Email</th>
                      <th className="w-1/8 px-4 py-2 font-medium">Role</th>
                      <th className="w-1/8 px-4 py-2 font-medium">Status</th>
                      {hasInvitedBy && <th className="w-1/6 px-4 py-2 font-medium">Invited by</th>}
                      <th className="w-1/6 px-4 py-2 font-medium">Sent</th>
                      {hasActions && <th className="px-4 py-2 font-medium"></th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.04]">
                    {invites.map((inv) => {
                      const status = inv.status ?? (inv.accepted_at ? 'accepted' : 'pending');
                      const canAct = status === 'pending' || status === 'expired';
                      const busy = actionId === `inv-${inv.id}`;
                      return (
                        <tr key={inv.id} className="text-[#5a5a55]">
                          <td className="px-4 py-2.5">{inv.email}</td>
                          <td className="px-4 py-2.5 capitalize">{inv.role ?? 'employee'}</td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${INVITE_STATUS[status] ?? INVITE_STATUS.pending}`}>
                              {status}
                            </span>
                          </td>
                          {hasInvitedBy && <td className="px-4 py-2.5 text-xs text-[#888]">{inv.invited_by?.name ?? '—'}</td>}
                          <td className="px-4 py-2.5 text-xs text-[#888]">
                            {inv.created_at ? new Date(inv.created_at).toLocaleDateString() : '—'}
                          </td>
                          {hasActions && (
                            <td className="px-4 py-2.5 text-right">
                              {canAct && (
                                <div className="inline-flex gap-2">
                                  <button
                                    onClick={() => doResend(inv.id)}
                                    disabled={busy}
                                    className="rounded-full border border-black/[0.06] px-2.5 py-1 text-xs font-medium text-[#5a5a55] hover:bg-[#fafafa] disabled:opacity-50"
                                  >
                                    Resend
                                  </button>
                                  <button
                                    onClick={() => doRevoke(inv.id)}
                                    disabled={busy}
                                    className="rounded-full border border-black/[0.09] px-2.5 py-1 text-xs font-medium text-[#5a5a55] hover:bg-[#fafafa] disabled:opacity-50"
                                  >
                                    Revoke
                                  </button>
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              );
            })()}
          </div>
        </>
      )}
    </div>
  );
}
