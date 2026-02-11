import React from 'react';
import { clsx } from 'clsx';

interface SurfaceCardProps extends React.HTMLAttributes<HTMLDivElement> {
  glass?: boolean;
}

export const SurfaceCard: React.FC<SurfaceCardProps> = ({ glass = true, className, children, ...rest }) => {
  return (
    <div {...rest} className={clsx('card', glass && 'surface-glass', className)}>
      {children}
    </div>
  );
};
