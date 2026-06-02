import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import authService from '../../services/authService.js';
import FormField from '../../shared/components/FormField.jsx';
import { useToast } from '../../shared/components/ToastProvider.jsx';
import { Button, Card, CardBody } from '../../shared/components/ui/index.js';

const ResetPasswordPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const email = location.state?.email;
  const resetToken = location.state?.resetToken;

  useEffect(() => {
    if (!email || !resetToken) {
      navigate('/forgot-password');
    }
  }, [email, navigate, resetToken]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!newPassword || !confirmPassword) {
      toast.addToast('Please fill in both password fields.', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.addToast('Passwords must match.', 'error');
      return;
    }

    try {
      setLoading(true);
      await authService.resetPassword({ email, resetToken, newPassword, confirmPassword });
      toast.addToast('Password reset successful.', 'success');
      navigate('/login');
    } catch (error) {
      toast.addToast(error.response?.data?.message || 'Unable to reset password.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="auth-card">
      <CardBody>
        <div className="auth-brand">
          <span className="auth-brand__mark">AP</span>
          <div>
            <h1>Reset password</h1>
            <p>Create a new password for your workspace account.</p>
          </div>
        </div>

        <form className="form-grid" onSubmit={handleSubmit}>
          <FormField className="form-field--full" label="New password" name="new-password" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required />
          <FormField
            className="form-field--full"
            label="Confirm password"
            name="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            error={confirmPassword && newPassword !== confirmPassword ? 'Passwords must match.' : ''}
            required
          />
          <div className="form-actions form-field--full">
            <Button type="submit" className="auth-submit" loading={loading}>
              Update password
            </Button>
          </div>
        </form>

        <div className="auth-links auth-links--center">
          <Link to="/login">Return to login</Link>
        </div>
      </CardBody>
    </Card>
  );
};

export default ResetPasswordPage;
