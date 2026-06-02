import { apiClient } from './axiosClient.js';

const extractData = (response) => response.data?.data ?? response.data ?? response;
const extractList = (response) => {
  const payload = extractData(response);
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
};

const reminderService = {
  listReminders: async (params) => {
    const response = await apiClient.get('/api/reminders', { params });
    const payload = extractData(response);
    if (payload?.metadata && Array.isArray(payload?.data)) {
      return payload;
    }
    return {
      metadata: {
        total: Array.isArray(payload) ? payload.length : payload?.total || 0,
        page: payload?.page || 1,
        limit: payload?.limit || (Array.isArray(payload) ? payload.length : 20),
        pages: payload?.pages || 1,
      },
      data: extractList(response),
    };
  },
  processDueReminders: async () => {
    const response = await apiClient.post('/api/reminders/process-due');
    return extractData(response);
  },
  createReminder: async (payload) => {
    const response = await apiClient.post('/api/reminders', payload);
    return extractData(response);
  },
  updateReminder: async (id, payload) => {
    const response = await apiClient.put(`/api/reminders/${id}`, payload);
    return extractData(response);
  },
  cancelReminder: async (id, payload = {}) => {
    const response = await apiClient.post(`/api/reminders/${id}/cancel`, payload);
    return extractData(response);
  },
  acknowledgeReminder: async (id) => {
    const response = await apiClient.post(`/api/reminders/${id}/acknowledge`);
    return extractData(response);
  },
  snoozeReminder: async (id, payload) => {
    const response = await apiClient.post(`/api/reminders/${id}/snooze`, payload);
    return extractData(response);
  },
};

export default reminderService;
