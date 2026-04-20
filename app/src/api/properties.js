import api from './client';

export const searchProperties = async (filters) => {
  const { data } = await api.get('/api/properties/search', { params: filters });
  return data;
};

export const getProperty = async (id) => {
  const { data } = await api.get(`/api/properties/${id}`);
  return data.data;
};

export const runSkipTrace = async (id) => {
  const { data } = await api.post(`/api/properties/${id}/skip-trace`);
  return data;
};
