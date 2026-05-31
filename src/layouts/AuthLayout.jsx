import React from 'react';
import { Outlet } from 'react-router-dom';

const AuthLayout = () => (
  <div className="auth-shell">
    <Outlet />
  </div>
);

export default AuthLayout;
