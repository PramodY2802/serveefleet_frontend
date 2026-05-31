import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import authService from '../services/authService.js';
import { clearSession, getSession, storeSession } from '../services/tokenStorage.js';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [refreshToken, setRefreshToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = getSession();
    if (session) {
      setUser(session.user);
      setAccessToken(session.accessToken);
      setRefreshToken(session.refreshToken);
    }
    setLoading(false);
  }, []);

  const setSession = useCallback(({ user, accessToken, refreshToken }) => {
    setUser(user);
    setAccessToken(accessToken);
    setRefreshToken(refreshToken);
    storeSession({ user, accessToken, refreshToken });
  }, []);

  const login = useCallback(async ({ email, password }) => {
    const response = await authService.login({ email, password });
    setSession(response);
    return response;
  }, [setSession]);

  const logout = useCallback(async () => {
    await authService.logout();
    clearSession();
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      accessToken,
      refreshToken,
      loading,
      isAuthenticated: Boolean(user && accessToken),
      login,
      logout,
      setSession,
    }),
    [user, accessToken, refreshToken, loading, login, logout, setSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }
  return context;
};
