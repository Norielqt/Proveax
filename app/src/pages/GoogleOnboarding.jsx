import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { googleComplete } from '../api/auth';

export default function GoogleOnboarding() {
  const { refresh }  = useAuth();
  const navigate     = useNavigate();
  const { state }    = useLocation();

  const stagingToken = state?.token;

  const [companyName, setCompanyName] = useState('');
  const [error, setError]             = useState('');
  const [loading, setLoading]         = useState(false);

  // Guard: if somehow reached without a staging token, redirect away
  if (!stagingToken) {
    navigate('/register', { replace: true });
    return null;
  }

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await googleComplete(stagingToken, companyName);
      await refresh();
      navigate('/search', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-gray-900">One last step</h1>
          <p className="mt-1 text-sm text-gray-600">
            What is the name of your company? We'll set up your workspace.
          </p>

          {error && (
            <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</div>
          )}

          <form onSubmit={submit} className="mt-4 space-y-3">
            <input
              required
              placeholder="Company name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <button
              disabled={loading}
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Setting up…' : 'Continue'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
