import { apiClient } from './axiosClient.js';

const extractData = (response) => response.data?.data ?? response.data ?? response;

const extractList = (response) => {
  const data = extractData(response);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.bills)) return data.bills;
  return [];
};

const billingService = {
  list: async (params = {}) => {
    const response = await apiClient.get('/api/bills', { params });
    return extractList(response);
  },

  get: async (id) => {
    const response = await apiClient.get(`/api/bills/${id}`);
    return extractData(response);
  },

  getByService: async (serviceId) => {
    const response = await apiClient.get(`/api/bills/by-service/${serviceId}`);
    return extractData(response);
  },

  generateFromService: async (serviceId) => {
    const response = await apiClient.post(`/api/bills/from-service/${serviceId}`);
    return extractData(response);
  },
};

export default billingService;
