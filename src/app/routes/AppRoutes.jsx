import React, { lazy } from 'react';
import { Route, Routes, Navigate, useParams } from 'react-router-dom';
import ProtectedRoute from '../../shared/components/ProtectedRoute.jsx';
import RoleRoute from '../../shared/components/RoleRoute.jsx';
import AuthLayout from '../../layouts/AuthLayout.jsx';
import AppLayout from '../../layouts/AppLayout.jsx';

const LoginPage = lazy(() => import('../../modules/auth/LoginPage.jsx'));
const ForgotPasswordPage = lazy(() => import('../../modules/auth/ForgotPasswordPage.jsx'));
const ResetPasswordPage = lazy(() => import('../../modules/auth/ResetPasswordPage.jsx'));
const GoogleAuthSuccessPage = lazy(() => import('../../modules/auth/GoogleAuthSuccessPage.jsx'));
const DashboardPage = lazy(() => import('../../modules/dashboard/DashboardPage.jsx'));
const CustomerPage = lazy(() => import('../../modules/customer/CustomerPage.jsx'));
const VehiclePage = lazy(() => import('../../modules/vehicle/VehiclePage.jsx'));
const ServicePage = lazy(() => import('../../modules/service/ServicePage.jsx'));
const SearchPage = lazy(() => import('../../modules/search/SearchPage.jsx'));
const BillPreviewPage = lazy(() => import('../../modules/billing/BillPreviewPage.jsx'));

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<Navigate replace to="/dashboard" />} />
    <Route element={<AuthLayout />}>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/google-auth-success" element={<GoogleAuthSuccessPage />} />
    </Route>

    <Route element={<ProtectedRoute />}>
      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/customers" element={<CustomerPage />} />
        <Route path="/alluser" element={<Navigate replace to="/customers" />} />
        <Route path="/customers/:customerId/vehicles" element={<VehiclePage />} />
        <Route path="/vehicles/:customerId" element={<NavigateToCustomerVehicles />} />
        <Route path="/vehicles/:vehicleId/services" element={<ServicePage />} />
        <Route path="/services/:vehicleId" element={<NavigateToVehicleServices />} />
        <Route path="/bills/:billId/preview" element={<BillPreviewPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/users" element={<RoleRoute roles={['admin']}><CustomerPage /></RoleRoute>} />
      </Route>
    </Route>

    <Route path="*" element={<Navigate to="/dashboard" replace />} />
  </Routes>
);

const NavigateToCustomerVehicles = () => {
  const { customerId } = useParams();
  return <Navigate replace to={`/customers/${customerId}/vehicles`} />;
};

const NavigateToVehicleServices = () => {
  const { vehicleId } = useParams();
  return <Navigate replace to={`/vehicles/${vehicleId}/services`} />;
};

export default AppRoutes;
