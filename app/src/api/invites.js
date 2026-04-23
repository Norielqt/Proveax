import api, { saveToken } from './client';

export const createInvite = async (email, role = 'employee') =>
  (await api.post('/api/invites', { email, role })).data;

export const listInvites = async () =>
  (await api.get('/api/invites')).data;

export const resendInvite = async (id) =>
  (await api.post(`/api/invites/${id}/resend`)).data;

export const revokeInvite = async (id) =>
  (await api.post(`/api/invites/${id}/revoke`)).data;

export const acceptInvite = async (payload) => {
  const data = (await api.post('/api/invites/accept', payload)).data;
  saveToken(data.token);
  return data;
};
