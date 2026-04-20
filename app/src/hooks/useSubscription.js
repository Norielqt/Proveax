import { useEffect, useState } from 'react';
import { getSubscriptionStatus } from '../api/subscription';

export function useSubscription() {
  const [state, setState] = useState({ loading: true, data: null });

  useEffect(() => {
    getSubscriptionStatus()
      .then((data) => setState({ loading: false, data }))
      .catch(() => setState({ loading: false, data: null }));
  }, []);

  return {
    loading:   state.loading,
    hasAccess: state.data?.has_access ?? false,
    isOnTrial: state.data?.is_on_trial ?? false,
    isActive:  state.data?.is_active ?? false,
    daysLeft:  state.data?.days_left ?? null,
    status:    state.data?.status ?? null,
  };
}
