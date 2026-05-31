import { apiClient } from './axiosClient.js';

const extractData = (response) => response.data?.data ?? response.data ?? response;
const extractService = (response) => {
  const payload = extractData(response);
  if (payload?.newService) return payload.newService;
  if (payload?.service) return payload.service;
  return payload;
};
const extractList = (response) => {
  const payload = extractData(response);
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
};

const serviceService = {
  list: async (params) => {
    const response = await apiClient.get('/api/services', { params });
    return extractList(response);
  },
  get: async (id) => {
    const response = await apiClient.get(`/api/services/${id}`);
    return extractData(response);
  },
  create: async (payload) => {
    const response = await apiClient.post('/api/services', payload);
    return extractService(response);
  },
  update: async (id, payload) => {
    const response = await apiClient.put(`/api/services/${id}`, payload);
    return extractData(response);
  },
  remove: async (id) => {
    const response = await apiClient.delete(`/api/services/${id}`);
    return extractData(response);
  },
};

export default serviceService;
