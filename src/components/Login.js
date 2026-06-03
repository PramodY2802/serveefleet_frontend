import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import Swal from "sweetalert2";
import "bootstrap/dist/css/bootstrap.min.css";
import "../styles/Login.css";
import { GoogleLogin } from "@react-oauth/google";

const backendUrl = process.env.REACT_APP_BACKEND_URL;

const LoginPage = () => {
  const [animate, setAnimate] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => setAnimate(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // ▶️ Email/Password Login
  const handleLogin = async (e) => {
    e.preventDefault();

    if (!email.trim() || !password.trim()) {
      return Swal.fire({
        icon: "warning",
        title: "Missing Fields",
        text: "Please enter both email and password.",
        confirmButtonColor: "#1abc9c",
      });
    }

    try {
      const response = await axios.post(`${backendUrl}/api/auth/login`, {
        email,
        password,
      });

      Swal.fire({
        icon: "success",
        title: "Logged In!",
        text: `Welcome back, ${response.data.user.name}.`,
        confirmButtonText: "Continue",
        confirmButtonColor: "#1abc9c",
      }).then(() => {
        localStorage.setItem("token", response.data.token);
        localStorage.setItem("user", JSON.stringify(response.data.user));
        navigate("/dashboard");
      });
    } catch (err) {
      const message =
        err.response?.data?.message || "Server error. Please try again.";
      Swal.fire({
        icon: "error",
        title: "Login Failed",
        text: message,
        confirmButtonColor: "#e74c3c",
      });
    }
  };

  // ▶️ Google Login Redirect
  const handleGoogleLogin = () => {
    window.location.href = `${backendUrl}/api/auth/google`; // Redirects to backend
  };

  return (
    <div className="login-page">
      {/* Animated Background */}
      <div className="bg-shape shape1"></div>
      <div className="bg-shape shape2"></div>
      <div className="bg-shape shape3"></div>
      <div className="bg-shape shape4"></div>

      {/* Login Card */}
      <div className={`login-card ${animate ? "card-entrance" : ""}`}>
        <div className="card-body">
          <center>
            <img
            src="/autopulse.png"
            alt="AutoPulse Logo"
            className="mb-3"
            style={{ width: "130px", height: "auto" }}
          />
          </center>


          <form onSubmit={handleLogin}>
            {/* Email Input */}
            <div className="form-group mb-3 position-relative">
              <input
                type="email"
                className="form-control animated-input"
                id="email"
                placeholder=" "
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <label htmlFor="email" className="floating-label px-1">
                Email Address
              </label>
            </div>

            {/* Password Input */}
            <div className="form-group mb-4 position-relative">
              <input
                type="password"
                className="form-control animated-input"
                id="password"
                placeholder=" "
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <label htmlFor="password" className="floating-label px-1">
                Password
              </label>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              className="btn btn-primary btn-block btn-pulse mb-3"
            >
              Log In
            </button>
          </form>

          {/* Divider */}
          <div className="text-center text-muted my-2">or</div>

          {/* Google Login Button */}
          <div className="d-flex justify-content-center mb-3">
            <GoogleLogin
              onSuccess={handleGoogleLogin}
              onError={() =>
                Swal.fire({
                  icon: "error",
                  title: "Google Login Failed",
                  text: "Something went wrong, please try again.",
                  confirmButtonColor: "#e74c3c",
                })
              }
              useOneTap={false}
            />
          </div>

          {/* Forgot Password */}
          <div className="text-center">
            <Link
              to="/forgot-password"
              className="text-decoration-none link-animated"
            >
              Forgot password?
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="footer-text text-center text-light">
        © {new Date().getFullYear()} AutoPulse
      </div>
    </div>
  );
};

export default LoginPage;
