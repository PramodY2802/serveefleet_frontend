import { apiClient } from './axiosClient.js';

const extractData = (response) => response.data?.data ?? response.data ?? response;
const extractList = (response) => {
  const payload = extractData(response);
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
};

const vehicleService = {
  list: async (params) => {
    const response = await apiClient.get('/api/vehicles', { params });
    return extractList(response);
  },
  get: async (id) => {
    const response = await apiClient.get(`/api/vehicles/${id}`);
    return extractData(response);
  },
  create: async (payload) => {
    const response = await apiClient.post('/api/vehicles', payload);
    return extractData(response);
  },
  update: async (id, payload) => {
    const response = await apiClient.put(`/api/vehicles/${id}`, payload);
    return extractData(response);
  },
  remove: async (id) => {
    const response = await apiClient.delete(`/api/vehicles/${id}`);
    return extractData(response);
  },
};

export default vehicleService;
