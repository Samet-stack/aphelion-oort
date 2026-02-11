import React from 'react';
import { ApiPlanPoint } from '../services/api';

interface PinMarkerProps {
  point: ApiPlanPoint;
  isSelected: boolean;
  onClick: (e: React.MouseEvent) => void;
}

export const PinMarker: React.FC<PinMarkerProps> = ({ point, isSelected, onClick }) => {
  const isProblem = point.status === 'a_faire' || point.category === 'defaut';
  const color = isProblem ? '#ef4444' : point.status === 'termine' ? '#22c55e' : '#f59e0b';

  // Stable per marker instance to avoid flicker across rerenders.
  const animationDelayRef = React.useRef(`${Math.random() * 0.2}s`);

  return (
    <div
      className={`pin-marker animate-pin-pop ${isSelected ? 'pin-marker--active' : ''} ${isProblem ? 'pin-marker--problem' : ''}`}
      data-point-id={point.id}
      style={{
        left: `${point.positionX}%`,
        top: `${point.positionY}%`,
        animationDelay: animationDelayRef.current,
      }}
      onClick={onClick}
      title={`#${point.pointNumber} ${point.title}`}
    >
      <div className="pin-svg-wrapper -translate-x-1/2 -translate-y-full">
        <svg
          width="40"
          height="40"
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="pin-svg"
        >
          <path
            d="M20 0C11.1634 0 4 7.16344 4 16C4 26.5 20 40 20 40C20 40 36 26.5 36 16C36 7.16344 28.8366 0 20 0Z"
            fill={color}
          />
          <circle cx="20" cy="16" r="6" fill="#0f172a" fillOpacity="0.3" />
          <circle cx="20" cy="16" r="3" fill="white" />
          {isProblem && (
            <path
              d="M20 8V18"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              opacity={0.8}
            />
          )}
        </svg>
        {/* Number Badge */}
        <div className="pin-badge">
          {point.pointNumber}
        </div>
      </div>
    </div>
  );
};
