import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((current) => [...current, { id, message, type }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4500);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const contextValue = useMemo(
    () => ({ addToast, removeToast, toasts }),
    [addToast, removeToast, toasts]
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div className="toast-region">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`app-toast app-toast--${toast.type}`}
            role="alert"
            aria-live="assertive"
            aria-atomic="true"
          >
            <p className="app-toast__message">{toast.message}</p>
            <button type="button" className="ui-button ui-button--ghost ui-button--sm ui-button--icon" aria-label="Close" onClick={() => removeToast(toast.id)}>
              <i className="bi bi-x-lg" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};
