import React from 'react';
import Button from './Button.jsx';

export const LoadingState = ({ title = 'Loading data', description = 'Please wait while the latest records are prepared.' }) => (
  <div className="state-block" role="status" aria-live="polite">
    <span className="state-block__loader" aria-hidden="true" />
    <h3>{title}</h3>
    <p>{description}</p>
  </div>
);

export const EmptyState = ({ title = 'No records found', description = 'There is nothing to show here yet.', actionLabel, onAction }) => (
  <div className="state-block">
    <div className="state-block__icon">
      <i className="bi bi-inbox" aria-hidden="true" />
    </div>
    <h3>{title}</h3>
    <p>{description}</p>
    {actionLabel && onAction && <Button onClick={onAction}>{actionLabel}</Button>}
  </div>
);

export const ErrorState = ({ title = 'Something went wrong', description = 'Please try again or contact support if this continues.' }) => (
  <div className="state-block state-block--error">
    <div className="state-block__icon">
      <i className="bi bi-exclamation-triangle" aria-hidden="true" />
    </div>
    <h3>{title}</h3>
    <p>{description}</p>
  </div>
);
