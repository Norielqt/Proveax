import api from './client';
import { saveToken, clearToken } from './client';

export const login = async (email, password) => {
  const { data } = await api.post('/api/login', { email, password });
  saveToken(data.token);
  return data;
};

export const register = async (payload) => {
  const { data } = await api.post('/api/register', payload);
  saveToken(data.token);
  return data;
};

export const logout = async () => {
  try {
    return (await api.post('/api/logout')).data;
  } finally {
    clearToken();
  }
};

export const me = async () => (await api.get('/api/me')).data;

export const updateProfile = async (payload) => (await api.put('/api/me/profile', payload)).data;

/** Returns the Google OAuth URL to open in a popup */
export const getGoogleRedirectUrl = async () => {
  const { data } = await api.get('/auth/google/redirect-url');
  return data.url;
};

/** Complete Google onboarding for brand-new users */
export const googleComplete = async (staging_token, company_name) => {
  const { data } = await api.post('/api/auth/google/complete', { staging_token, company_name });
  saveToken(data.token);
  return data;
};
