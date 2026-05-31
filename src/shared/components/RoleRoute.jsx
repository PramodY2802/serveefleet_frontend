import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import useAuth from '../../hooks/useAuth.js';

const RoleRoute = ({ roles = [], children, redirectTo = '/dashboard' }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="auth-shell">
        <div className="state-block" role="status" aria-live="polite">
          <span className="state-block__loader" aria-hidden="true" />
          <h3>Checking permissions</h3>
          <p>Confirming access to this workspace area.</p>
        </div>
      </div>
    );
  }

  const hasAccess = user && roles.includes(user.role);
  if (!hasAccess) {
    return <Navigate to={redirectTo} replace />;
  }

  return children ? children : <Outlet />;
};

export default RoleRoute;
