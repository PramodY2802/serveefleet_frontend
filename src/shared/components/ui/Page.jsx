import React from 'react';

export const Page = ({ children, className = '' }) => <section className={`page-shell ${className}`}>{children}</section>;

export const PageHeader = ({ title, description, eyebrow, actions }) => (
  <div className="page-header">
    <div>
      {eyebrow && <p className="page-header__eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </div>
    {actions && <div className="page-header__actions">{actions}</div>}
  </div>
);
