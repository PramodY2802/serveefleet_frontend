import { apiClient } from './axiosClient.js';

const extractData = (response) => response.data?.data ?? response.data ?? response;
const extractList = (response) => {
  const payload = extractData(response);
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
};

const customerService = {
  list: async (params) => {
    const response = await apiClient.get('/api/customers', { params });
    return extractList(response);
  },
  get: async (id) => {
    const response = await apiClient.get(`/api/customers/${id}`);
    return extractData(response);
  },
  create: async (payload) => {
    const response = await apiClient.post('/api/customers', payload);
    return extractData(response);
  },
  update: async (id, payload) => {
    const response = await apiClient.put(`/api/customers/${id}`, payload);
    return extractData(response);
  },
  remove: async (id) => {
    const response = await apiClient.delete(`/api/customers/${id}`);
    return extractData(response);
  },
};

export default customerService;
