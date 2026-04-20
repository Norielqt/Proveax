import api from './client';

/**
 * Search the national ATTOM database.
 * Requires postalcode OR (city + state).
 */
export const attomSearch = async (params) => {
  const { data } = await api.get('/api/attom/search', { params });
  return data; // { data: [...], total: N } or { error: '...' }
};

/**
 * Full ATTOM property detail by ATTOM ID (numeric).
 */
export const attomDetailById = async (attomId) => {
  const { data } = await api.get('/api/attom/detail', { params: { attomId } });
  return data;
};

/**
 * Full ATTOM property detail.
 * @param {string} address1 - street, e.g. "123 Ocean Dr"
 * @param {string} address2 - "City ST ZIP", e.g. "Miami FL 33139"
 */
export const attomDetail = async (address1, address2) => {
  const { data } = await api.get('/api/attom/detail', { params: { address1, address2 } });
  return data; // { data: {...} } or { error: '...' }
};

/**
 * ATTOM Automated Valuation Model (AVM).
 */
export const attomAvm = async (address1, address2) => {
  const { data } = await api.get('/api/attom/avm', { params: { address1, address2 } });
  return data; // { data: { avm_value, avm_low, avm_high, ... } } or { error: '...' }
};

/**
 * Full property report — all sections (location, characteristics, owner,
 * valuation, transactions, mortgage, permits) in one request.
 */
export const attomFullDetail = async ({ attomId, address1, address2 } = {}) => {
  const params = attomId ? { attomId } : { address1, address2 };
  const { data } = await api.get('/api/attom/fulldetail', { params });
  return data; // { data: { location, characteristics, owner, valuation, transactions, mortgage, permits } }
};
