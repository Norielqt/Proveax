import api from './client';

export const getSubscriptionStatus = async () =>
  (await api.get('/api/billing/status')).data;

export const startCheckout = async (plan) =>
  (await api.post('/api/billing/checkout', plan ? { plan } : {})).data;

export const createSubscriptionIntent = async (plan) =>
  (await api.post('/api/billing/subscription/intent', { plan })).data;

export const confirmSubscription = async (paymentIntentId, plan) =>
  (await api.post('/api/billing/subscription/confirm', { payment_intent_id: paymentIntentId, plan })).data;

export const cancelSubscription = async () =>
  (await api.post('/api/billing/subscription/cancel')).data;
