import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  text?: string;
  inline?: boolean;
  size?: number;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  text = 'Chargement...',
  inline = false,
  size = 24,
}) => {
  return (
    <div className={`loading-state ${inline ? 'loading-state--inline' : ''}`}>
      <Loader2 size={size} className="spin" />
      {text && <p className="loading-state__text">{text}</p>}
    </div>
  );
};
