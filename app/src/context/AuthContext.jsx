import { createContext, useContext, useEffect, useState } from 'react';
import * as authApi from '../api/auth';
import { saveToken, getToken } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [tenant, setTenant]   = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    try {
      const data = await authApi.me();
      setUser(data.user);
      setTenant(data.tenant);
    } catch {
      setUser(null);
      setTenant(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const login = async (email, password) => {
    const data = await authApi.login(email, password);
    setUser(data.user);
    setTenant(data.tenant);
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      setTenant(null);
    }
  };

  /**
   * Redirects the entire page to Google for OAuth.
   * Works on all devices — no popup needed.
   * Throws if the redirect URL cannot be fetched from the server.
   */
  const loginWithGoogle = async () => {
    const url = await authApi.getGoogleRedirectUrl();
    window.location.href = url;
    // Page navigates away; this function never returns normally.
    await new Promise(() => {});
  };

  return (
    <AuthContext.Provider value={{ user, tenant, loading, login, logout, refresh, loginWithGoogle }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
