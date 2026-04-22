import api from './client';

export const getActivityLogs = async (params) =>
  (await api.get('/api/activity-logs', { params })).data;

export const getActivitySummary = async (params = {}) =>
  (await api.get('/api/activity/summary', { params })).data;

export const listActivityActions = async () =>
  (await api.get('/api/activity-logs', { params: { per_page: 1 } })).data?.actions ?? [];
