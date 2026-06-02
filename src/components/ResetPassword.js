import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Swal from 'sweetalert2';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import '../styles/Login.css'; // Reuse animated background & styling

const backendUrl = process.env.REACT_APP_BACKEND_URL;

const ResetPassword = () => {
  const [animate, setAnimate] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const navigate = useNavigate();

  // Grab the email from location.state (passed from OTP step)
  const location = useLocation();
  const email = location.state?.email || '';
  const resetToken = location.state?.resetToken || '';

  useEffect(() => {
    // If no email was provided, redirect back to login
    if (!email || !resetToken) {
      navigate('/login');
      return;
    }
    const timer = setTimeout(() => setAnimate(true), 100);
    return () => clearTimeout(timer);
  }, [email, navigate, resetToken]);

  const handleResetSubmit = async (e) => {
    e.preventDefault();

    // 1) Basic front-end validation
    if (!newPassword.trim() || !confirmPassword.trim()) {
      return Swal.fire({
        icon: 'warning',
        title: 'Missing Fields',
        text: 'Please fill in both password fields.',
        confirmButtonColor: '#1abc9c'
      });
    }

    if (newPassword !== confirmPassword) {
      return Swal.fire({
        icon: 'error',
        title: 'Passwords Do Not Match',
        text: 'Please ensure both passwords are identical.',
        confirmButtonColor: '#e74c3c'
      });
    }

    try {
      // 2) Show loading popup
      Swal.fire({
        title: 'Updating Password...',
        didOpen: () => {
          Swal.showLoading();
        },
        allowOutsideClick: false
      });

      // 3) Call backend API to reset password
     await axios.post(`${backendUrl}/api/auth/reset-password`, {
  email,
  resetToken,
  newPassword,
  confirmPassword
});


      // 4) Close loading, show success
      Swal.close();
      await Swal.fire({
        icon: 'success',
        title: 'Password Updated',
        text: 'Your password has been reset successfully.',
        confirmButtonText: 'Log In',
        confirmButtonColor: '#1abc9c'
      });

      // 5) Redirect to login page
      navigate('/login');
    } catch (error) {
      // 6) Close loading, show error
      Swal.close();

      const message =
        error.response && error.response.data && error.response.data.message
          ? error.response.data.message
          : 'Failed to reset password. Please try again.';

      Swal.fire({
        icon: 'error',
        title: 'Reset Failed',
        text: message,
        confirmButtonColor: '#e74c3c'
      });
    }
  };

  return (
    <div className="login-page">
      {/* Reused animated background shapes */}
      <div className="bg-shape shape1"></div>
      <div className="bg-shape shape2"></div>
      <div className="bg-shape shape3"></div>
      <div className="bg-shape shape4"></div>

      {/* Reset Password Card */}
      <div className={`login-card ${animate ? 'card-entrance' : ''}`}>
        <div className="card-body">
          <h3 className="card-title text-center mb-4 glow-text">
            <i className="bi bi-shield-lock-fill me-2"></i>Reset Password
          </h3>
          <p className="text-center text-muted small mb-4">
            Enter a new password for <strong>{email}</strong>.
          </p>

          <form onSubmit={handleResetSubmit}>
            {/* New Password */}
            <div className="form-group mb-3 position-relative">
              <input
                type="password"
                className="form-control animated-input"
                id="newPassword"
                placeholder=" "
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              <label htmlFor="newPassword" className="floating-label">
                <i className="bi bi-key-fill me-2"></i>New Password
              </label>
            </div>

            {/* Confirm Password */}
            <div className="form-group mb-4 position-relative">
              <input
                type="password"
                className="form-control animated-input"
                id="confirmPassword"
                placeholder=" "
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              <label htmlFor="confirmPassword" className="floating-label">
                <i className="bi bi-check2-circle me-2"></i>Confirm Password
              </label>
            </div>

            {/* Update Password Button */}
            <button type="submit" className="btn btn-primary btn-block btn-pulse mb-3">
              <i className="bi bi-arrow-repeat me-2"></i>Update Password
            </button>

            <div className="text-center">
              <Link to="/login" className="text-decoration-none link-animated">
                <i className="bi bi-arrow-left-circle me-1"></i>Back to Login
              </Link>
            </div>
          </form>
        </div>
      </div>

      {/* Footer Text */}
      <div className="footer-text text-center text-light">
        © {new Date().getFullYear()} AutoPulse
      </div>
    </div>
  );
};

export default ResetPassword;
