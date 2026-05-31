import React from 'react';

const Badge = ({ children, tone = 'primary', className = '' }) => (
  <span className={`ui-badge ui-badge--${tone} ${className}`}>{children}</span>
);

export default Badge;
