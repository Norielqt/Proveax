import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import GoogleAuthButton from '../components/GoogleAuthButton';
import logo from '../assets/Proveax_loading.png';

export default function Login() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [showPwd, setShowPwd]   = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await login(email, password);
      sessionStorage.setItem('show_welcome', '1');
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = ({ status, token }) => {
    if (status === 'login') {
      sessionStorage.setItem('show_welcome', '1');
      return navigate('/search', { replace: true });
    }
    if (status === 'onboard') return navigate('/google/onboarding', { replace: true, state: { token } });
  };

  return (
    <div className="flex min-h-screen bg-white font-sans text-[#111]">

      {/* ── Left 70% — editorial hero side ── */}
      <div className="relative hidden flex-col overflow-hidden bg-white p-12 lg:flex lg:w-[70%]">

        {/* Top: logo + back link */}
        <div className="relative flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={logo} alt="Proveax" className="h-8 w-auto" />
          </Link>
          <Link
            to="/"
            className="anim-fade-in inline-flex items-center gap-1.5 text-[12px] font-medium text-[#5a5a55] transition-colors hover:text-[#111]"
          >
            <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 8H3M7 4 3 8l4 4" />
            </svg>
            Back to home
          </Link>
        </div>

        {/* Center: headline + image */}
        <div className="flex flex-1 flex-col justify-center">
          <div className="relative grid max-w-[680px] gap-10">
          <div>
            <p className="anim-fade-up mb-5 text-[11px] font-medium uppercase tracking-[0.18em] text-[#888]" style={{ animationDelay: '0ms' }}>
              · Welcome back
            </p>
            <h1 className="anim-fade-up font-display text-[64px] font-normal leading-[0.98] tracking-[-1.2px] text-[#111]" style={{ animationDelay: '100ms' }}>
              The whole story
              <br />
              behind every address.
            </h1>
            <p className="anim-fade-up mt-6 max-w-[440px] text-[15px] leading-[1.7] text-[#5a5a55]" style={{ animationDelay: '200ms' }}>
              Pick up where you left off. Your saved properties, leads and
              research are waiting inside.
            </p>
          </div>

          {/* Hero image with floating card */}
          <div className="anim-fade-in relative" style={{ animationDelay: '300ms' }}>
            <div className="overflow-hidden rounded-[24px] bg-[#f4f1eb] shadow-[0_30px_70px_-30px_rgba(17,17,17,0.3)] ring-1 ring-black/5">
              <img
                src="/landing-hero.png"
                alt="Property"
                className="h-[260px] w-full object-cover"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            </div>
          </div>
        </div>
        </div>

      </div>

      {/* ── Right 30% — form side ── */}
      <div className="flex w-full flex-col border-l border-black/[0.06] bg-white lg:w-[30%]">
        <div className="flex flex-1 flex-col justify-center px-8 py-10">
          <div className="mb-8">
            <h2 className="font-display text-[34px] font-normal leading-[1.05] tracking-[-0.8px] text-[#111]">
              Sign in.
            </h2>
            <p className="mt-1.5 text-[13px] text-[#7a7a72]">
              Welcome back to Proveax.
            </p>
          </div>

          {error && (
            <div className="mb-5 rounded-xl border border-red-200/70 bg-red-50/80 px-4 py-3 text-[13px] text-red-700">
              {error}
            </div>
          )}

          <GoogleAuthButton
            label="Continue with Google"
            onSuccess={handleGoogleSuccess}
            onError={(msg) => setError(msg)}
          />

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-black/[0.08]" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-[10px] uppercase tracking-[0.18em] text-[#aaa]">or</span>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.1em] text-[#888]">
                Email
              </label>
              <input
                required
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-black/[0.09] bg-white px-3.5 py-3 text-[14px] text-[#111] placeholder-[#bbb] outline-none transition focus:border-[#111] focus:ring-2 focus:ring-black/5"
              />
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-[11px] font-medium uppercase tracking-[0.1em] text-[#888]">
                  Password
                </label>
                <a href="#" tabIndex={-1} className="text-[11px] text-[#5a5a55] underline-offset-4 hover:text-[#111] hover:underline">
                  Forgot?
                </a>
              </div>
              <div className="relative">
                <input
                  required
                  type={showPwd ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-black/[0.09] bg-white px-3.5 py-3 pr-10 text-[14px] text-[#111] placeholder-[#bbb] outline-none transition focus:border-[#111] focus:ring-2 focus:ring-black/5"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#999] transition-colors hover:text-[#111] focus:outline-none"
                  aria-label={showPwd ? 'Hide password' : 'Show password'}
                >
                  {showPwd ? <EyeIcon /> : <EyeOffIcon />}
                </button>
              </div>
            </div>

            <button
              disabled={loading}
              className="group mt-1 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#111] py-3 text-[14px] font-medium text-white transition-all hover:bg-[#2a2a2a] disabled:opacity-50"
            >
              {loading ? 'Signing in…' : 'Sign in'}
              {!loading && (
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 8h10M9 4l4 4-4 4" />
                </svg>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-[12px] text-[#888]">
            Don't have an account?{' '}
            <Link to="/register" className="font-medium text-[#111] underline-offset-4 hover:underline">
              Create one
            </Link>
          </p>
        </div>
      </div>

    </div>
  );
}

function EyeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}
