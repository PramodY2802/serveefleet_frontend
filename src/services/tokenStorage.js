const AUTH_STORAGE_KEY = 'servifleet_auth';

export const getSession = () => {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.error('Failed to read auth session', error);
    return null;
  }
};

export const storeSession = ({ user, accessToken, refreshToken }) => {
  const session = { user, accessToken, refreshToken };
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
};

export const clearSession = () => {
  localStorage.removeItem(AUTH_STORAGE_KEY);
};

export const getAccessToken = () => getSession()?.accessToken || null;
export const getRefreshToken = () => getSession()?.refreshToken || null;
export const getCurrentUser = () => getSession()?.user || null;

export const updateAccessToken = (accessToken) => {
  const session = getSession();
  if (session) {
    storeSession({ ...session, accessToken });
  }
};

export const updateCurrentUser = (user) => {
  const session = getSession();
  if (session) {
    storeSession({ ...session, user });
  }
};
