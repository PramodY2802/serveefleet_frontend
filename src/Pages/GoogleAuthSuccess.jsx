// src/pages/GoogleAuthSuccess.jsx
import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

const backendUrl = process.env.REACT_APP_BACKEND_URL;

const GoogleAuthSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  useEffect(() => {
    if (token) {
      localStorage.setItem("token", token);

      fetch(`${backendUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data) => {
          const user = data.data?.user || data.user;
          localStorage.setItem("user", JSON.stringify(user));
          navigate("/dashboard");
        })
        .catch(() => navigate("/login"));
    } else {
      navigate("/login");
    }
  }, [token, navigate]);

  return <div>Logging in with Google...</div>;
};

export default GoogleAuthSuccess;
