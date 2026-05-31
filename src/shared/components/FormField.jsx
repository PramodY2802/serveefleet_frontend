import React from 'react';

const FormField = ({
  label,
  value,
  onChange,
  type = 'text',
  name,
  placeholder,
  required = false,
  helperText,
  error,
  className = '',
  as = 'input',
  children,
  action,
  ...props
}) => {
  const Control = as;

  return (
    <div className={`form-field ${className}`}>
      {label && (
        <label htmlFor={name} className="form-field__label">
          {label}
          {required ? ' *' : ''}
        </label>
      )}
      <div className={`form-field__control-shell ${action ? 'has-action' : ''}`}>
        <Control
          id={name}
          name={name}
          type={as === 'input' ? type : undefined}
          value={value}
          onChange={onChange}
          className="form-field__control"
          placeholder={placeholder}
          required={required}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={helperText || error ? `${name}-hint` : undefined}
          {...props}
        >
          {children}
        </Control>
        {action && <div className="form-field__action">{action}</div>}
      </div>
      {helperText && !error && (
        <p id={`${name}-hint`} className="form-field__helper">
          {helperText}
        </p>
      )}
      {error && (
        <p id={`${name}-hint`} className="form-field__error">
          {error}
        </p>
      )}
    </div>
  );
};

export default FormField;
