import api from './client';

// Timesheets
export const listTimesheets = async (params = {}) =>
  (await api.get('/api/timesheets', { params })).data;

export const generateTimesheet = async (week_start, user_id) =>
  (await api.post('/api/timesheets/generate', { week_start, user_id })).data;

export const submitTimesheet = async (id) =>
  (await api.post(`/api/timesheets/${id}/submit`)).data;

export const approveTimesheet = async (id, note) =>
  (await api.post(`/api/timesheets/${id}/approve`, { note })).data;

export const rejectTimesheet = async (id, note) =>
  (await api.post(`/api/timesheets/${id}/reject`, { note })).data;

export const timesheetExportUrl = (params = {}) => {
  const q = new URLSearchParams(params).toString();
  return `/api/timesheets/export${q ? `?${q}` : ''}`;
};

// API usage
export const getApiUsage = async (params = {}) =>
  (await api.get('/api/admin/api-usage', { params })).data;

// Team overview
export const getTeamOverview = async () =>
  (await api.get('/api/admin/team/overview')).data;
