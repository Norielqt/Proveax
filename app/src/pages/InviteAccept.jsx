import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { acceptInvite } from '../api/invites';
import { useAuth } from '../context/AuthContext';

export default function InviteAccept() {
  const { token }   = useParams();
  const { refresh } = useAuth();
  const navigate    = useNavigate();
  const [form, setForm]       = useState({ name: '', password: '', password_confirmation: '' });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await acceptInvite({ ...form, token });
      await refresh();
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to accept invite.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-gray-900">Accept your invite</h1>
          <p className="mt-1 text-sm text-gray-600">Set up your account to join the team.</p>

          {error && <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</div>}

          <form onSubmit={submit} className="mt-4 space-y-3">
            <input required placeholder="Your name" value={form.name} onChange={set('name')}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <input required type="password" placeholder="Password (min 8 chars)" value={form.password} onChange={set('password')}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <input required type="password" placeholder="Confirm password" value={form.password_confirmation}
              onChange={set('password_confirmation')}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <button disabled={loading}
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'Setting up…' : 'Join team'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
