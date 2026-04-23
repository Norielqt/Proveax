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

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = ({ status, token }) => {
    if (status === 'login')   return navigate('/search', { replace: true });
    if (status === 'onboard') return navigate('/google/onboarding', { replace: true, state: { token } });
  };

  return (
    <div className="flex min-h-screen">

      {/* ── Left panel 70% — dark brand side ── */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[#042C53] p-12 lg:flex lg:w-[70%]">
        {/* Orbs */}
        <div
          className="pointer-events-none absolute -left-32 top-0 h-[500px] w-[500px] rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, #185FA5, transparent 70%)' }}
        />
        <div
          className="pointer-events-none absolute -bottom-24 right-0 h-[400px] w-[400px] rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, #378ADD, transparent 70%)' }}
        />
        {/* Dot grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)',
            backgroundSize: '28px 28px',
          }}
        />

        {/* Top: logo */}
        <div className="relative">
          <Link to="/">
            <img src={logo} alt="Proveax" className="h-9 w-auto" />
          </Link>
        </div>

        {/* Center: headline */}
        <div className="relative max-w-[520px]">
          <div className="mb-4 inline-block rounded-full bg-white/10 px-4 py-1.5 text-[12px] font-medium tracking-[0.06em] text-[#B5D4F4]">
            Property data platform
          </div>
          <h1 className="mb-4 text-[42px] font-semibold leading-[1.12] tracking-[-0.8px] text-white">
            Find any property.{' '}
            <span className="text-[#85B7EB]">Know everything about it.</span>
          </h1>
          <p className="text-[16px] leading-[1.7] text-[#85B7EB]">
            Instant access to verified property records, ownership data, and market
            trends — all in one place.
          </p>

          {/* Stats */}
          <div className="mt-10 grid grid-cols-4 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            {[
              { n: '150M+', l: 'Property records' },
              { n: '12K+',  l: 'Active users' },
              { n: '98%',   l: 'Data accuracy' },
              { n: '4.9★',  l: 'Avg rating' },
            ].map((s, i) => (
              <div
                key={s.l}
                className={`px-5 py-5 text-center ${i < 3 ? 'border-r border-white/10' : ''}`}
              >
                <div className="text-[20px] font-semibold text-white">{s.n}</div>
                <div className="mt-1 text-[11px] text-[#85B7EB]">{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom: copyright */}
        <div className="relative text-[12px] text-[#378ADD]">
          © 2026 Proveax. All rights reserved.
        </div>
      </div>

      {/* ── Right panel 30% — form side ── */}
      <div className="flex w-full flex-col items-center justify-center bg-white px-6 py-12 lg:w-[30%]">
        {/* Mobile logo */}
        <div className="mb-8 lg:hidden">
          <Link to="/">
            <img src={logo} alt="Proveax" className="h-8 w-auto" />
          </Link>
        </div>

        <div className="w-full max-w-[340px]">
          <div className="mb-7">
            <h1 className="text-[22px] font-semibold tracking-[-0.4px] text-[#111]">Sign in</h1>
            <p className="mt-1 text-[13px] text-[#888]">Welcome back to Proveax.</p>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-[#444]">Email</label>
              <input
                required
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-[#E8F0FB] bg-[#F7FAFF] px-3.5 py-2.5 text-[14px] text-[#111] placeholder-[#bbb] outline-none transition focus:border-[#185FA5] focus:bg-white focus:ring-2 focus:ring-[#185FA5]/15"
              />
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-[12px] font-medium text-[#444]">Password</label>
                <a href="#" className="text-[12px] text-[#185FA5] hover:underline">Forgot password?</a>
              </div>
              <input
                required
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-[#E8F0FB] bg-[#F7FAFF] px-3.5 py-2.5 text-[14px] text-[#111] placeholder-[#bbb] outline-none transition focus:border-[#185FA5] focus:bg-white focus:ring-2 focus:ring-[#185FA5]/15"
              />
            </div>
            <button
              disabled={loading}
              className="w-full rounded-lg bg-gradient-to-br from-[#185FA5] to-[#0C447C] py-2.5 text-[14px] font-semibold text-white shadow-md shadow-[#185FA5]/25 transition-all hover:shadow-lg hover:shadow-[#185FA5]/35 disabled:opacity-50"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#E8F0FB]" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-[11px] uppercase tracking-[0.08em] text-[#bbb]">or</span>
            </div>
          </div>

          <GoogleAuthButton
            label="Continue with Google"
            onSuccess={handleGoogleSuccess}
            onError={(msg) => setError(msg)}
          />

          <p className="mt-6 text-center text-[13px] text-[#888]">
            Don't have an account?{' '}
            <Link to="/register" className="font-medium text-[#185FA5] hover:underline">
              Create one free
            </Link>
          </p>
        </div>
      </div>

    </div>
  );
}
