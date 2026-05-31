import React from 'react';

const Button = ({
  children,
  type = 'button',
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconOnly = false,
  className = '',
  disabled,
  ...props
}) => (
  <button
    type={type}
    className={`ui-button ui-button--${variant} ui-button--${size} ${iconOnly ? 'ui-button--icon' : ''} ${className}`}
    disabled={disabled || loading}
    aria-busy={loading || undefined}
    {...props}
  >
    {loading ? <span className="ui-spinner" aria-hidden="true" /> : icon ? <i className={`bi ${icon}`} aria-hidden="true" /> : null}
    {!iconOnly && <span>{children}</span>}
  </button>
);

export default Button;
