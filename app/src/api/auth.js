import api, { ensureCsrf } from './client';

export const login = async (email, password) => {
  await ensureCsrf();
  const { data } = await api.post('/api/login', { email, password });
  return data;
};

export const register = async (payload) => {
  await ensureCsrf();
  const { data } = await api.post('/api/register', payload);
  return data;
};

export const logout = async () => (await api.post('/api/logout')).data;
export const me     = async () => (await api.get('/api/me')).data;

/** Returns the Google OAuth URL to open in a popup */
export const getGoogleRedirectUrl = async () => {
  const { data } = await api.get('/auth/google/redirect-url');
  return data.url;
};

/** Complete Google onboarding for brand-new users */
export const googleComplete = async (staging_token, company_name) => {
  await ensureCsrf();
  const { data } = await api.post('/api/auth/google/complete', { staging_token, company_name });
  return data;
};
