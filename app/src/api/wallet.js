import api from './client';

export const getWalletSummary = async () => (await api.get('/api/wallet/summary')).data;
export const getTransactions  = async () => (await api.get('/api/wallet/transactions')).data.data;

export const createTopUpIntent = async (traces) =>
  (await api.post('/api/wallet/top-up/intent', { traces })).data;

export const chargeSavedCard = async (traces) =>
  (await api.post('/api/wallet/top-up/charge', { traces })).data;

export const confirmTopUp = async (paymentIntentId) =>
  (await api.post('/api/wallet/top-up/confirm', { payment_intent_id: paymentIntentId })).data;
