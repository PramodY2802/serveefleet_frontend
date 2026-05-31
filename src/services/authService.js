import { publicClient } from './axiosClient.js';
import { clearSession, getRefreshToken, storeSession, updateCurrentUser } from './tokenStorage.js';

const authService = {
  login: async ({ email, password }) => {
    const response = await publicClient.post('/api/auth/login', { email, password });
    const payload = response.data.data || response.data;
    const { user, accessToken, refreshToken = null } = payload;
    storeSession({ user, accessToken, refreshToken });
    return { user, accessToken, refreshToken };
  },

  logout: async () => {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      await publicClient.post('/api/auth/logout', { refreshToken });
    }
    clearSession();
  },

  refreshToken: async (refreshToken) => {
    const response = await publicClient.post('/api/auth/refresh-token', { refreshToken });
    const payload = response.data.data || response.data;
    const previousSession = JSON.parse(localStorage.getItem('servifleet_auth') || '{}');
    storeSession({
      ...previousSession,
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken,
    });
    return payload;
  },

  forgotPassword: async (email) => {
    const response = await publicClient.post('/api/auth/forgot-password', { email });
    return response.data;
  },

  verifyOtp: async ({ email, otp }) => {
    const response = await publicClient.post('/api/auth/verify-otp', { email, otp });
    return response.data;
  },

  resetPassword: async ({ email, newPassword, confirmPassword }) => {
    const response = await publicClient.post('/api/auth/reset-password', {
      email,
      newPassword,
      confirmPassword,
    });
    return response.data;
  },

  fetchProfile: async (accessToken) => {
    const response = await publicClient.get('/api/auth/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const user = response.data.data?.user || response.data.data || response.data.user;
    updateCurrentUser(user);
    return user;
  },
};

export default authService;
