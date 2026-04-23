import axios from 'axios';

const TOKEN_KEY = 'proveax_token';

export const saveToken  = (token) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = ()      => localStorage.removeItem(TOKEN_KEY);
export const getToken   = ()      => localStorage.getItem(TOKEN_KEY);

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
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
