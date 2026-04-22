import api from './client';

export const listMembers = async () =>
  (await api.get('/api/team/members')).data;

export const updateMemberRole = async (id, role) =>
  (await api.patch(`/api/team/members/${id}/role`, { role })).data;

export const pauseMember = async (id) =>
  (await api.post(`/api/team/members/${id}/pause`)).data;

export const unpauseMember = async (id) =>
  (await api.post(`/api/team/members/${id}/unpause`)).data;

export const removeMember = async (id) =>
  (await api.delete(`/api/team/members/${id}`)).data;

export const getTeamSettings = async () =>
  (await api.get('/api/team/settings')).data;

export const updateTeamSettings = async (payload) =>
  (await api.patch('/api/team/settings', payload)).data;

export const giveMonitoringConsent = async () =>
  (await api.post('/api/me/consent')).data;
