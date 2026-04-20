import api from './client';

export const getSubscriptionStatus = async () =>
  (await api.get('/api/billing/status')).data;

export const startCheckout = async () =>
  (await api.post('/api/billing/checkout')).data;
