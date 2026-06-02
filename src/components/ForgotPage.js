import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Swal from 'sweetalert2';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import '../styles/Login.css'; // Reuse the login background & animations

const backendUrl = process.env.REACT_APP_BACKEND_URL;


const ForgotPassword = () => {
  const [animate, setAnimate] = useState(false);
  const [step, setStep] = useState('email'); // 'email' or 'otp'
  const [email, setEmail] = useState('');
  const [otpValues, setOtpValues] = useState(['', '', '', '']);
  const inputsRef = useRef([]);
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => setAnimate(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // 1) Handle sending OTP to the email
  const handleSendOtp = async (e) => {
    e.preventDefault();

    if (!email.trim()) {
      return Swal.fire({
        icon: 'warning',
        title: 'Email Required',
        text: 'Please enter your registered email address.',
        confirmButtonColor: '#1abc9c'
      });
    }

    try {
      // Show a loading toast
      Swal.fire({
        title: 'Sending OTP...',
        didOpen: () => {
          Swal.showLoading();
        },
        allowOutsideClick: false
      });

      // Call backend endpoint
    const response = await axios.post(`${backendUrl}/api/auth/forgot-password`, { email });


      Swal.close(); // Close the loading popup

      // On success, show success popup
      await Swal.fire({
        icon: 'success',
        title: 'OTP Sent',
        text: 'Check your email for the 4-digit code.',
        confirmButtonText: 'OK',
        confirmButtonColor: '#1abc9c'
      });

      // Move to OTP entry step
      setStep('otp');
      setOtpValues(['', '', '', '']); // reset OTP fields

      // Focus first OTP input after a short delay (for animation)
      setTimeout(() => {
        inputsRef.current[0]?.focus();
      }, 300);
    } catch (error) {
      Swal.close();

      const message =
        error.response && error.response.data && error.response.data.message
          ? error.response.data.message
          : 'Failed to send OTP. Please try again.';

      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: message,
        confirmButtonColor: '#e74c3c'
      });
    }
  };

  // 2) Handle OTP digit changes
  const handleOtpChange = (e, idx) => {
    const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 1);
    const newOtp = [...otpValues];
    newOtp[idx] = val;
    setOtpValues(newOtp);
    if (val && idx < 3) {
      inputsRef.current[idx + 1]?.focus();
    }
  };

  // 3) Handle deleting/backspacing in OTP fields
  const handleOtpKeyDown = (e, idx) => {
    if (e.key === 'Backspace' && !otpValues[idx] && idx > 0) {
      inputsRef.current[idx - 1]?.focus();
    }
  };

  // 4) Verify the 4-digit OTP with the backend
  const handleVerifyOtp = async (e) => {
    e.preventDefault();

    const otpCode = otpValues.join('');
    if (otpCode.length < 4) {
      return Swal.fire({
        icon: 'warning',
        title: 'Incomplete OTP',
        text: 'Please enter all 4 digits.',
        confirmButtonColor: '#1abc9c'
      });
    }

    try {
      // Show a loading toast
      Swal.fire({
        title: 'Verifying OTP...',
        didOpen: () => {
          Swal.showLoading();
        },
        allowOutsideClick: false
      });

      // Call backend endpoint
     const response = await axios.post(`${backendUrl}/api/auth/verify-otp`, { email, otp: otpCode });
      const resetToken = response.data?.data?.resetToken;
      if (!resetToken) {
        throw new Error('Reset token was not issued by the server.');
      }


      Swal.close();

      // On success, show success popup
      await Swal.fire({
        icon: 'success',
        title: 'OTP Verified',
        text: 'You may now reset your password.',
        confirmButtonText: 'Reset Password',
        confirmButtonColor: '#1abc9c'
      });

      // Navigate to the Reset Password page, passing email in state or query if desired
      navigate('/reset-password', { state: { email, resetToken } });
    } catch (error) {
      Swal.close();

      const message =
        error.response && error.response.data && error.response.data.message
          ? error.response.data.message
          : 'OTP verification failed. Please try again.';

      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: message,
        confirmButtonColor: '#e74c3c'
      });

      // Optionally clear OTP fields on failure
      setOtpValues(['', '', '', '']);
      inputsRef.current[0]?.focus();
    }
  };

  return (
    <div className="login-page">
      {/* Animated Background Shapes */}
      <div className="bg-shape shape1"></div>
      <div className="bg-shape shape2"></div>
      <div className="bg-shape shape3"></div>
      <div className="bg-shape shape4"></div>

      {/* Centered Card */}
      <div className={`login-card ${animate ? 'card-entrance' : ''}`}>
        <div className="card-body">
          {step === 'email' ? (
            <>
              <h3 className="card-title text-center mb-4 glow-text">
                <i className="bi bi-unlock-fill me-2"></i>Forgot Password
              </h3>
              <p className="text-center text-muted small mb-4">
                Enter your registered email to receive a 4-digit OTP.
              </p>

              <form onSubmit={handleSendOtp}>
                {/* Email Input */}
                <div className="form-group mb-4 position-relative">
                  <input
                    type="email"
                    className="form-control animated-input"
                    id="email"
                    placeholder=" "
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <label htmlFor="email" className="floating-label">
                    Email Address
                  </label>
                </div>

                {/* Send OTP Button */}
                <button type="submit" className="btn btn-primary btn-block btn-pulse mb-3">
                  <i className="bi bi-send-check-fill me-2"></i>Send OTP
                </button>

                <div className="text-center">
                  <Link to="/login" className="text-decoration-none link-animated">
                    <i className="bi bi-arrow-left-circle me-1"></i>Back to Login
                  </Link>
                </div>
              </form>
            </>
          ) : (
            <>
              <h3 className="card-title text-center mb-4 glow-text">
                <i className="bi bi-key-fill me-2"></i>Enter OTP
              </h3>
              <p className="text-center text-muted small mb-4">
                We’ve sent you a 4-digit code. Enter it below.
              </p>

              <form onSubmit={handleVerifyOtp}>
                {/* OTP Input Boxes */}
                <div className="d-flex justify-content-between mb-4 otp-container">
                  {otpValues.map((digit, idx) => (
                    <input
                      key={idx}
                      type="text"
                      className="form-control otp-input text-center"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(e, idx)}
                      onKeyDown={(e) => handleOtpKeyDown(e, idx)}
                      ref={(el) => (inputsRef.current[idx] = el)}
                      required
                    />
                  ))}
                </div>

                {/* Verify OTP Button */}
                <div className="d-grid">
                  <button type="submit" className="btn btn-primary btn-pulse">
                    Verify OTP
                  </button>
                </div>

                <div className="mt-3 text-center">
                  <Link to="/login" className="text-decoration-none link-animated">
                    <i className="bi bi-arrow-left-circle me-1"></i>Back to Login
                  </Link>
                </div>
              </form>
            </>
          )}
        </div>
      </div>

      {/* Footer Text */}
      <div className="footer-text text-center text-light">
        © {new Date().getFullYear()} AutoPulse
      </div>
    </div>
  );
};

export default ForgotPassword;
