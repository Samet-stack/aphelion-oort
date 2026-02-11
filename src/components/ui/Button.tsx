import React from 'react';
import { clsx } from 'clsx';

type ButtonVariant = 'primary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  pill?: boolean;
  loading?: boolean;
}

const variantClassMap: Record<ButtonVariant, string> = {
  primary: 'btn--primary',
  ghost: 'btn--ghost',
  danger: 'btn--danger',
};

const sizeClassMap: Record<ButtonSize, string> = {
  sm: 'btn--sm',
  md: '',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  pill = false,
  loading = false,
  className,
  children,
  disabled,
  ...rest
}) => {
  const isDisabled = disabled || loading;
  return (
    <button
      {...rest}
      disabled={isDisabled}
      className={clsx(
        'btn pressable',
        variantClassMap[variant],
        sizeClassMap[size],
        pill && 'btn--pill',
        className,
      )}
      aria-busy={loading ? 'true' : undefined}
    >
      {children}
    </button>
  );
};
