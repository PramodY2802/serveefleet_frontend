import React, { Suspense } from 'react';
import AppRoutes from './routes/AppRoutes.jsx';

const App = () => (
  <Suspense
    fallback={
      <div className="auth-shell">
        <div className="state-block" role="status" aria-live="polite">
          <span className="state-block__loader" aria-hidden="true" />
          <h3>Loading application</h3>
          <p>Preparing your workspace.</p>
        </div>
      </div>
    }
  >
    <AppRoutes />
  </Suspense>
);

export default App;
