import api from './client';

export const getOnboardingState = async () =>
  (await api.get('/api/billing/onboarding/state')).data;

export const createOnboardingSetupIntent = async () =>
  (await api.post('/api/billing/onboarding/setup-intent')).data;

export const subscribeWithTrial = async (plan, paymentMethodId) =>
  (await api.post('/api/billing/onboarding/subscribe', {
    plan,
    payment_method_id: paymentMethodId,
  })).data;
