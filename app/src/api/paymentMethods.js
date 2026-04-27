import api from './client';

export const listPaymentMethods = async () =>
  (await api.get('/api/payment-methods')).data;

export const createSetupIntent = async () =>
  (await api.post('/api/payment-methods/setup-intent')).data;

export const setDefaultPaymentMethod = async (id) =>
  (await api.post(`/api/payment-methods/${id}/default`)).data;

export const deletePaymentMethod = async (id) =>
  (await api.delete(`/api/payment-methods/${id}`)).data;
