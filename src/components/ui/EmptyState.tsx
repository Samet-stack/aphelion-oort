import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  hint?: string;
  compact?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  hint,
  compact = false,
}) => {
  return (
    <div className={`empty-state ${compact ? 'empty-state--compact' : ''}`}>
      <Icon size={compact ? 32 : 40} className="empty-state__icon" />
      <p className="empty-state__title">{title}</p>
      {hint && <p className="empty-state__hint">{hint}</p>}
    </div>
  );
};
