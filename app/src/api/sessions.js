import api from './client';

export const getCurrentSession = async () =>
  (await api.get('/api/work-sessions/current')).data;

export const getTodaySummary = async () =>
  (await api.get('/api/work-sessions/today-summary')).data;

export const listSessions = async (params = {}) =>
  (await api.get('/api/work-sessions', { params })).data;

export const startSession = async (screenshotsEnabled) =>
  (await api.post('/api/work-sessions', { screenshots_enabled: !!screenshotsEnabled })).data;

export const heartbeat = async (id, activeSeconds, idleSeconds) =>
  (await api.post(`/api/work-sessions/${id}/heartbeat`, {
    active_seconds: activeSeconds,
    idle_seconds:   idleSeconds,
  })).data;

export const endSession = async (id, { activeSeconds, idleSeconds, reason } = {}) =>
  (await api.post(`/api/work-sessions/${id}/end`, {
    active_seconds: activeSeconds,
    idle_seconds:   idleSeconds,
    reason,
  })).data;

export const listScreenshots = async (params = {}) =>
  (await api.get('/api/screenshots', { params })).data;

export const uploadScreenshot = async (sessionId, blob, capturedAt) => {
  const form = new FormData();
  form.append('session_id',  String(sessionId));
  form.append('captured_at', capturedAt);
  form.append('image', blob, `shot_${Date.now()}.jpg`);
  return (await api.post('/api/screenshots', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })).data;
};

export const deleteScreenshot = async (id) =>
  (await api.delete(`/api/screenshots/${id}`)).data;
