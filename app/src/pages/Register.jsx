import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import GoogleAuthButton from '../components/GoogleAuthButton';

export default function Register() {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '', email: '', password: '', password_confirmation: '', company_name: '',
  });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await register(form);
      await refresh();
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = ({ status, token }) => {
    if (status === 'login')   return navigate('/search', { replace: true });
    if (status === 'onboard') return navigate('/google/onboarding', { replace: true, state: { token } });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="block text-center text-xl font-bold text-blue-600 mb-6">PropIntel</Link>
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-gray-900">Create your account</h1>
          <p className="mt-1 text-sm text-gray-600">Start your 7-day free trial.</p>

          {error && <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</div>}

          <GoogleAuthButton
            label="Sign up with Google"
            onSuccess={handleGoogleSuccess}
            onError={(msg) => setError(msg)}
          />

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
            <div className="relative flex justify-center"><span className="bg-white px-2 text-xs text-gray-400">or continue with email</span></div>
          </div>

          <form onSubmit={submit} className="space-y-3">
            <input required placeholder="Your name" value={form.name} onChange={set('name')}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <input required placeholder="Company name" value={form.company_name} onChange={set('company_name')}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <input required type="email" placeholder="Work email" value={form.email} onChange={set('email')}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <input required type="password" placeholder="Password (min 8 chars)" value={form.password} onChange={set('password')}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <input required type="password" placeholder="Confirm password" value={form.password_confirmation}
              onChange={set('password_confirmation')}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <button disabled={loading}
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-gray-600">
            Already have an account? <Link to="/login" className="text-blue-600">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
