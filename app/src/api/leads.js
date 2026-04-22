import api from './client';

export const listLeads = async () =>
  (await api.get('/api/leads')).data;

export const createLead = async (payload = {}) =>
  (await api.post('/api/leads', payload)).data;

export const updateLead = async (id, payload) =>
  (await api.patch(`/api/leads/${id}`, payload)).data;

export const deleteLead = async (id) =>
  (await api.delete(`/api/leads/${id}`)).data;

export const LEAD_TYPES = ['cold', 'warm', 'hot', 'qualified', 'closed'];
