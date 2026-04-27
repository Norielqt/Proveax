import { createContext, useContext, useEffect, useState } from 'react';
import * as authApi from '../api/auth';
import { saveToken, getToken } from '../api/client';

const AuthContext = createContext(null);

const POPUP_WIDTH  = 500;
const POPUP_HEIGHT = 620;

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
   * Opens the Google OAuth popup and returns a promise that resolves with:
   *   { status: 'login' }                       — existing user, session ready
   *   { status: 'onboard', token: string }       — new user, needs company name
   * Or rejects on error / popup blocked.
   */
  const loginWithGoogle = () =>
    new Promise(async (resolve, reject) => {
      let url;
      try {
        url = await authApi.getGoogleRedirectUrl();
      } catch {
        return reject(new Error('Could not reach server.'));
      }

      const left = window.screenX + (window.outerWidth  - POPUP_WIDTH)  / 2;
      const top  = window.screenY + (window.outerHeight - POPUP_HEIGHT) / 2;
      const popup = window.open(
        url,
        'google_oauth',
        `width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${left},top=${top},toolbar=no,menubar=no`,
      );

      if (!popup) return reject(new Error('Popup blocked. Please allow popups for this site.'));

      const origin = new URL(import.meta.env.VITE_API_URL).origin;

      let settled = false;

      const cleanup = () => {
        window.removeEventListener('message', messageHandler);
        window.removeEventListener('focus', focusHandler);
      };

      const messageHandler = async (event) => {
        if (event.origin !== origin) return;
        const { type, payload } = event.data ?? {};
        console.log('[Google OAuth] message received:', { type, origin: event.origin });
        if (settled) return;
        settled = true;
        cleanup();

        if (type === 'google_login_ok') {
          saveToken(payload);
          await refresh();
          resolve({ status: 'login' });
        } else if (type === 'google_onboard') {
          resolve({ status: 'onboard', token: payload });
        } else {
          reject(new Error('Google sign-in failed.'));
        }
      };

      // When the popup closes (user dismissed it), focus returns to this window.
      // We wait a short tick to let any postMessage arrive first before treating
      // it as a cancellation. This avoids polling popup.closed which is blocked
      // by the COOP header Google sends on their consent page.
      const focusHandler = () => {
        setTimeout(() => {
          if (!settled) {
            settled = true;
            cleanup();
            reject(new Error('Sign-in cancelled.'));
          }
        }, 300);
      };

      window.addEventListener('message', messageHandler);
      window.addEventListener('focus', focusHandler);
    });

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
