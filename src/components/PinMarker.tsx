import React from 'react';
import { ApiPlanPoint } from '../services/api';

interface PinMarkerProps {
  point: ApiPlanPoint;
  isSelected: boolean;
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
}

const PinMarkerComponent: React.FC<PinMarkerProps> = ({ point, isSelected, onPointerUp }) => {
  const isProblem = point.status === 'a_faire' || point.category === 'defaut';
  const color = isProblem ? '#ef4444' : point.status === 'termine' ? '#22c55e' : '#f59e0b';

  // Stable per marker instance to avoid flicker across rerenders.
  const animationDelayRef = React.useRef(`${Math.random() * 0.2}s`);

  const num = String(point.pointNumber);

  return (
    <div
      className={`pin-marker animate-pin-pop ${isSelected ? 'pin-marker--active' : ''} ${isProblem ? 'pin-marker--problem' : ''}`}
      data-point-id={point.id}
      style={{
        left: `${point.positionX}%`,
        top: `${point.positionY}%`,
        animationDelay: animationDelayRef.current,
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={onPointerUp}
      title={`#${point.pointNumber} ${point.title}`}
    >
      <div className="pin-svg-wrapper">
        <svg
          width="36"
          height="46"
          viewBox="0 0 36 46"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="pin-svg"
        >
          {/* Pin shape */}
          <path
            d="M18 0C8.06 0 0 8.06 0 18C0 30 18 46 18 46C18 46 36 30 36 18C36 8.06 27.94 0 18 0Z"
            fill={color}
          />
          {/* White stroke outline */}
          <path
            d="M18 1.5C8.89 1.5 1.5 8.89 1.5 18C1.5 28.8 18 44 18 44C18 44 34.5 28.8 34.5 18C34.5 8.89 27.11 1.5 18 1.5Z"
            stroke="white"
            strokeWidth="1.5"
            fill="none"
          />
          {/* Inner circle */}
          <circle cx="18" cy="17" r="11" fill="white" />
          {/* Number */}
          <text
            x="18"
            y="17"
            textAnchor="middle"
            dominantBaseline="central"
            fill={color}
            fontFamily="Arial, sans-serif"
            fontWeight="800"
            fontSize={num.length > 2 ? '11' : num.length > 1 ? '13' : '15'}
          >
            {num}
          </text>
        </svg>
      </div>
    </div>
  );
};

export const PinMarker = React.memo(
  PinMarkerComponent,
  (prevProps, nextProps) =>
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.point === nextProps.point
);
