import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import authService from '../../services/authService.js';
import FormField from '../../shared/components/FormField.jsx';
import { useToast } from '../../shared/components/ToastProvider.jsx';
import { Button, Card, CardBody } from '../../shared/components/ui/index.js';

const ForgotPasswordPage = () => {
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '']);
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef([]);
  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (step === 'otp') {
      inputRefs.current[0]?.focus();
    }
  }, [step]);

  const handleSendOtp = async (event) => {
    event.preventDefault();
    if (!email.trim()) {
      toast.addToast('Email is required to send OTP.', 'error');
      return;
    }

    try {
      setLoading(true);
      await authService.forgotPassword(email);
      toast.addToast('OTP sent to your email.', 'success');
      setStep('otp');
    } catch (error) {
      toast.addToast(error.response?.data?.message || 'Unable to send OTP.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (event, index) => {
    const value = event.target.value.replace(/[^0-9]/g, '').slice(0, 1);
    const nextOtp = [...otp];
    nextOtp[index] = value;
    setOtp(nextOtp);
    if (value && index < otp.length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleVerifyOtp = async () => {
    const code = otp.join('');
    if (code.length < 4) {
      toast.addToast('Please enter the full OTP code.', 'error');
      return;
    }

    try {
      setLoading(true);
      await authService.verifyOtp({ email, otp: code });
      toast.addToast('OTP verified. Please reset your password.', 'success');
      navigate('/reset-password', { state: { email } });
    } catch (error) {
      toast.addToast(error.response?.data?.message || 'OTP verification failed.', 'error');
      setOtp(['', '', '', '']);
      inputRefs.current[0]?.focus();
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
            <h1>Recover access</h1>
            <p>{step === 'email' ? 'We will send a verification code to your email.' : `Enter the 4-digit code sent to ${email}.`}</p>
          </div>
        </div>

        {step === 'email' ? (
          <form className="form-grid" onSubmit={handleSendOtp}>
            <FormField className="form-field--full" label="Email address" name="forgot-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" required />
            <div className="form-actions form-field--full">
              <Button type="submit" className="auth-submit" loading={loading}>
                Send OTP
              </Button>
            </div>
          </form>
        ) : (
          <>
            <div className="otp-grid">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={(node) => (inputRefs.current[index] = node)}
                  type="text"
                  inputMode="numeric"
                  className="form-field__control otp-input"
                  value={digit}
                  onChange={(event) => handleOtpChange(event, index)}
                  maxLength={1}
                  aria-label={`OTP digit ${index + 1}`}
                />
              ))}
            </div>
            <div className="form-actions">
              <Button className="auth-submit" onClick={handleVerifyOtp} loading={loading}>
                Verify OTP
              </Button>
            </div>
          </>
        )}

        <div className="auth-links auth-links--center">
          <Link to="/login">Back to login</Link>
        </div>
      </CardBody>
    </Card>
  );
};

export default ForgotPasswordPage;
