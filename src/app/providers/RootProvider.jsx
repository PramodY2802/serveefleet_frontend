import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../../context/AuthContext.jsx';
import { ReminderAlertsProvider } from '../../context/ReminderAlertsContext.jsx';
import { ToastProvider } from '../../shared/components/ToastProvider.jsx';
import { ThemeProvider } from '../../shared/theme/ThemeProvider.jsx';

const RootProvider = ({ children }) => (
  <BrowserRouter>
    <ThemeProvider>
      <AuthProvider>
        <ReminderAlertsProvider>
          <ToastProvider>{children}</ToastProvider>
        </ReminderAlertsProvider>
      </AuthProvider>
    </ThemeProvider>
  </BrowserRouter>
);

export default RootProvider;
