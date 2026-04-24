import api from './client';

/**
 * Search the national Rentcast database.
 * Accepts: zipCode, city, state, latitude, longitude, radius, propertyType
 */
export const rentcastSearch = async (params) => {
  const { data } = await api.get('/api/rentcast/search', { params });
  return data; // { data: [...], total: N, has_more: bool }
};

export const rentcastLoadMore = async (params) => {
  const { data } = await api.get('/api/rentcast/search', { params: { ...params, loadMore: true } });
  return data; // { data: [...], total: N, has_more: bool }
};

/**
 * Fetch MLS sale listings from the Rentcast /listings/sale endpoint.
 * Accepts: zipCode, city, state, latitude, longitude, radius,
 *          status ('Active'|'Inactive'), listingType ('Pending'|'Withdrawn'|'Sold'|'Active')
 */
export const rentcastListings = async (params) => {
  const { data } = await api.get('/api/rentcast/listings', { params });
  return data; // { data: [...], total: N }
};

/**
 * Full property detail from Rentcast.
 * Pass either rentcastId (the Rentcast property ID string)
 * OR address + zipCode for address-based lookup.
 */
export const rentcastFullDetail = async ({ rentcastId, address, zipCode } = {}) => {
  const params = rentcastId ? { rentcastId } : { address, zipCode };
  const { data } = await api.get('/api/rentcast/fulldetail', { params });
  return data; // { data: { location, characteristics, owner, valuation, transactions, mortgage, permits } }
};

/**
 * Automated Valuation Model (AVM) only.
 */
export const rentcastAvm = async (address, zipCode) => {
  const { data } = await api.get('/api/rentcast/avm', { params: { address, zipCode } });
  return data; // { data: { avm_value, avm_low, avm_high, ... } }
};
