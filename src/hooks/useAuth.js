import { useAuthContext } from '../context/AuthContext.jsx';

const useAuth = () => {
  const { user, accessToken, isAuthenticated, login, logout, loading, setSession } = useAuthContext();
  return {
    user,
    accessToken,
    isAuthenticated,
    login,
    logout,
    loading,
    setSession,
  };
};

export default useAuth;
