import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface TextFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  id: string;
  label: string;
  icon?: LucideIcon;
  error?: string;
  hint?: string;
}

export const TextField = React.forwardRef<HTMLInputElement, TextFieldProps>(
  ({ id, label, icon: Icon, error, hint, className, ...rest }, ref) => {
    return (
      <div className="form-field">
        <label htmlFor={id}>
          {Icon ? <Icon size={14} aria-hidden="true" /> : null}
          {label}
        </label>
        <input
          ref={ref}
          id={id}
          className={className ? `input ${className}` : 'input'}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          {...rest}
        />
        {hint && !error ? (
          <p id={`${id}-hint`} className="auth-form__hint">
            {hint}
          </p>
        ) : null}
        {error ? (
          <p id={`${id}-error`} className="auth-form__hint">
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);

TextField.displayName = 'TextField';
