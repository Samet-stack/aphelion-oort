import React from 'react';
import { ArrowLeft, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface PlanHeaderProps {
    planName: string;
    siteName: string;
    onBack: () => void;
    zoomIn: () => void;
    zoomOut: () => void;
    resetTransform: () => void;
    zoomPercent: number;
}

export const PlanHeader: React.FC<PlanHeaderProps> = ({
    planName,
    siteName,
    onBack,
    zoomIn,
    zoomOut,
    resetTransform,
    zoomPercent,
}) => {
    return (
        <div className="view__top plan-header">
            <div className="plan-header__left">
                <button type="button" onClick={onBack} className="link-btn">
                    <ArrowLeft size={16} /> Retour
                </button>
                <div className="plan-header__info">
                    <h2 className="plan-header__title">{planName}</h2>
                    <span className="plan-header__subtitle">{siteName}</span>
                </div>
            </div>

            <div className="plan-header__actions">
                <div className="zoom-controls">
                    <button type="button" className="btn-icon" onClick={zoomOut} title="Dézoomer">
                        <ZoomOut size={18} />
                    </button>
                    <span className="zoom-value">{zoomPercent}%</span>
                    <button type="button" className="btn-icon" onClick={zoomIn} title="Zoomer">
                        <ZoomIn size={18} />
                    </button>
                    <button type="button" className="btn-icon" onClick={resetTransform} title="Réinitialiser">
                        <RotateCcw size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
};
