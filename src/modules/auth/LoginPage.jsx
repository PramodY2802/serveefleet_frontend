import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth.js';
import FormField from '../../shared/components/FormField.jsx';
import { useToast } from '../../shared/components/ToastProvider.jsx';
import { Button, Card, CardBody } from '../../shared/components/ui/index.js';

const LoginPage = () => {
  const { login } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!email.trim() || !password.trim()) {
      addToast('Please enter both email and password.', 'error');
      return;
    }

    try {
      setSubmitting(true);
      await login({ email, password });
      addToast('Login successful', 'success');
      navigate('/dashboard');
    } catch (error) {
      const message = error.response?.data?.message || 'Unable to login. Please check your credentials.';
      addToast(message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = `${process.env.REACT_APP_BACKEND_URL}/api/auth/google`;
  };

  return (
    <Card className="auth-card">
      <CardBody>
        <div className="auth-brand">
          <span className="auth-brand__mark">AP</span>
          <div>
            <h1>Sign in to AutoPulse</h1>
            <p>Access your fleet operations workspace.</p>
          </div>
        </div>

        <form className="form-grid" onSubmit={handleSubmit}>
          <FormField className="form-field--full" label="Email" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" required />
          <FormField className="form-field--full" label="Password" name="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required />
          <div className="form-actions form-field--full">
            <Button type="submit" className="auth-submit" loading={submitting}>
              Sign in
            </Button>
          </div>
        </form>

        <div className="auth-divider">or</div>
        <Button variant="outline" className="auth-submit" icon="bi-google" onClick={handleGoogleLogin}>
          Continue with Google
        </Button>

        <div className="auth-links">
          <Link to="/forgot-password">Forgot password?</Link>
          <Link to="/forgot-password">Need help?</Link>
        </div>
      </CardBody>
    </Card>
  );
};

export default LoginPage;
