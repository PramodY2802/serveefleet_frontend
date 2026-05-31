import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import authService from '../../services/authService.js';
import { storeSession, clearSession } from '../../services/tokenStorage.js';
import useAuth from '../../hooks/useAuth.js';
import { useToast } from '../../shared/components/ToastProvider.jsx';

const GoogleAuthSuccessPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { setSession } = useAuth();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      clearSession();
      navigate('/login');
      return;
    }

    const signInWithToken = async () => {
      try {
        storeSession({ user: null, accessToken: token, refreshToken: null });
        const user = await authService.fetchProfile(token);
        setSession({ user, accessToken: token, refreshToken: null });
        toast.addToast('Successfully signed in with Google.', 'success');
        navigate('/dashboard');
      } catch (error) {
        clearSession();
        toast.addToast('Google sign-in failed. Please login again.', 'error');
        navigate('/login');
      } finally {
        setLoading(false);
      }
    };

    signInWithToken();
  }, [navigate, searchParams, setSession, toast]);

  if (loading) {
    return (
      <div className="auth-shell">
        <div className="state-block" role="status" aria-live="polite">
          <span className="state-block__loader" aria-hidden="true" />
          <h3>Completing Google sign-in</h3>
          <p>Securing your session and opening the workspace.</p>
        </div>
      </div>
    );
  }

  return null;
};

export default GoogleAuthSuccessPage;
