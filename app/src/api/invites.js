import api from './client';

export const createInvite = async (email) =>
  (await api.post('/api/invites', { email })).data;

export const listInvites = async () =>
  (await api.get('/api/invites')).data;

export const acceptInvite = async (payload) =>
  (await api.post('/api/invites/accept', payload)).data;
