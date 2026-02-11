import React from 'react';
import { LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  icon?: LucideIcon;
  subtitle?: string;
  children?: React.ReactNode;
  compact?: boolean;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  icon: Icon,
  subtitle,
  children,
  compact = false,
}) => {
  return (
    <div className={`page-header ${compact ? 'page-header--compact' : ''}`}>
      <div>
        <h2 className="page-header__title">
          {Icon && <Icon size={compact ? 20 : 22} />}
          {title}
        </h2>
        {subtitle && <p className="page-header__subtitle">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
};
