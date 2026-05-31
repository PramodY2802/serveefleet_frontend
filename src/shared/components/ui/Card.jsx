import React from 'react';

export const Card = ({ children, className = '', interactive = false, ...props }) => (
  <div className={`ui-card ${interactive ? 'ui-card--interactive' : ''} ${className}`} {...props}>
    {children}
  </div>
);

export const CardHeader = ({ title, description, actions, className = '' }) => (
  <div className={`ui-card__header ${className}`}>
    <div>
      {title && <h3 className="ui-card__title">{title}</h3>}
      {description && <p className="ui-card__description">{description}</p>}
    </div>
    {actions && <div className="ui-card__actions">{actions}</div>}
  </div>
);

export const CardBody = ({ children, className = '' }) => <div className={`ui-card__body ${className}`}>{children}</div>;
