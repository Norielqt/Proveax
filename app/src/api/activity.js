import api from './client';

export const getActivityLogs = async (params) =>
  (await api.get('/api/activity-logs', { params })).data;

export const getActivitySummary = async () =>
  (await api.get('/api/activity/summary')).data;
