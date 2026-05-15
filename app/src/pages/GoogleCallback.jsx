import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { saveToken } from '../api/client';

/**
 * Landing page for the Google OAuth redirect callback.
 *
 * The backend redirects here with:
 *   ?type=google_login_ok  &payload=<sanctum_token>   — existing user login
 *   ?type=google_onboard   &payload=<staging_token>   — new user, needs company name
 *   ?type=google_error     &payload=<message>         — something went wrong
 */
export default function GoogleCallback() {
  const [searchParams]  = useSearchParams();
  const { refresh }     = useAuth();
  const navigate        = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    const type    = searchParams.get('type');
    const payload = searchParams.get('payload');

    if (type === 'google_login_ok') {
      saveToken(payload);
      sessionStorage.setItem('show_welcome', '1');
      refresh().then(() => navigate('/search', { replace: true }));
    } else if (type === 'google_onboard') {
      navigate('/google/onboarding', { replace: true, state: { token: payload } });
    } else {
      setError('Google sign-in failed. Please try again.');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <p className="text-sm text-red-600">{error}</p>
        <Link to="/login" className="text-sm font-medium text-blue-600 hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <svg className="h-6 w-6 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
        <p className="text-sm text-gray-500">Signing you in…</p>
      </div>
    </div>
  );
}
