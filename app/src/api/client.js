import axios from 'axios';

const TOKEN_KEY = 'proveax_token';

export const saveToken  = (token) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = ()      => localStorage.removeItem(TOKEN_KEY);
export const getToken   = ()      => localStorage.getItem(TOKEN_KEY);

// In production VITE_API_URL is the Railway URL (set at build time on Vercel).
// In local dev, derive the API host from the page's own hostname so that both
// desktop (localhost) and phone (192.168.x.x) work without any .env changes.
const envUrl = import.meta.env.VITE_API_URL ?? '';
const apiBase = (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1'))
  ? envUrl
  : `${window.location.protocol}//${window.location.hostname}:8000`;

const api = axios.create({
  baseURL: apiBase,
  headers: {
    Accept: 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && !location.pathname.startsWith('/login')) {
      clearToken();
      location.href = '/login';
    }
    return Promise.reject(err);
  },
);

export default api;
