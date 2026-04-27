import api from './client';

export const listLeads = async () =>
  (await api.get('/api/leads')).data;

export const createLead = async (payload = {}) =>
  (await api.post('/api/leads', payload)).data;

export const updateLead = async (id, payload) =>
  (await api.patch(`/api/leads/${id}`, payload)).data;

export const deleteLead = async (id) =>
  (await api.delete(`/api/leads/${id}`)).data;

export const uploadLeadFile = async (id, file) => {
  const form = new FormData();
  form.append('file', file);
  return (await api.post(`/api/leads/${id}/files`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })).data;
};

export const deleteLeadFile = async (leadId, fileId) =>
  api.delete(`/api/leads/${leadId}/files/${fileId}`);

export const LEAD_TYPES = ['cold', 'warm', 'hot', 'qualified', 'closed'];

export const SOURCE_TYPES = [
  'absentee_owner',
  'out_of_state_owner',
  'high_equity',
  'cash_buyers',
  'vacant_lots',
  'mls_withdrawn',
];

export const SOURCE_TYPE_LABELS = {
  absentee_owner:    'Absentee Owner',
  out_of_state_owner:'Out of State',
  high_equity:       'High Equity',
  cash_buyers:       'Cash Buyers',
  vacant_lots:       'Vacant Lots',
  mls_withdrawn:     'MLS Withdrawn',
};
