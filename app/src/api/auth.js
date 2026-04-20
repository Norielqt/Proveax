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
