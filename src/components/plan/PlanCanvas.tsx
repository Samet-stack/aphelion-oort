import React, { forwardRef } from 'react';
import { TransformWrapper, TransformComponent, ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { ApiPlanPoint } from '../../services/api';
import { PinMarker } from '../PinMarker';

interface PlanCanvasProps {
    imageDataUrl: string;
    points: ApiPlanPoint[];
    zoomPercent: number;
    selectedPointId?: string;
    isPanelOpen: boolean;
    onInit: (ref: ReactZoomPanPinchContentRef) => void;
    onZoomChange: (ref: ReactZoomPanPinchContentRef) => void;
    onGestureStart: () => void;
    onGestureEnd: (ref: ReactZoomPanPinchContentRef) => void;
    onCanvasPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
    onCanvasPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
    onCanvasPointerCancel: () => void;
    onMarkerClick: (point: ApiPlanPoint, e: React.PointerEvent<HTMLDivElement>) => void;
}

export const PlanCanvas = forwardRef<ReactZoomPanPinchContentRef, PlanCanvasProps>(
    (
        {
            imageDataUrl,
            points,
            zoomPercent,
            selectedPointId,
            isPanelOpen,
            onInit,
            onZoomChange,
            onGestureStart,
            onGestureEnd,
            onCanvasPointerDown,
            onCanvasPointerUp,
            onCanvasPointerCancel,
            onMarkerClick,
        },
        ref
    ) => {
        return (
            <div className="plan-viewer">
                <TransformWrapper
                    ref={ref}
                    initialScale={1}
                    minScale={0.3}
                    maxScale={5}
                    centerOnInit
                    limitToBounds={false}
                    wheel={{ step: 0.15, smoothStep: 0.004 }}
                    panning={{
                        velocityDisabled: false,
                        excluded: ['.pin-marker', '.plan-viewer__controls', '.plan-viewer__controls *'],
                    }}
                    pinch={{ step: 5, excluded: ['.pin-marker'] }}
                    doubleClick={{ disabled: true }}
                    onInit={(r) => {
                        onInit(r);
                        onZoomChange(r);
                    }}
                    onPanningStart={onGestureStart}
                    onPinchingStart={onGestureStart}
                    onZoomStart={onGestureStart}
                    onZoomStop={(r) => {
                        onGestureEnd(r);
                        onZoomChange(r);
                    }}
                    onPanningStop={(r) => {
                        onGestureEnd(r);
                        onZoomChange(r);
                    }}
                    onPinchingStop={(r) => {
                        onGestureEnd(r);
                        onZoomChange(r);
                    }}
                >
                    {({ zoomIn, zoomOut }) => (
                        <>
                            {/* Zoom controls */}
                            <div className="plan-viewer__controls">
                                <button
                                    type="button"
                                    className="btn btn--ghost"
                                    onClick={() => zoomIn(0.25)}
                                    title="Zoom +"
                                >
                                    <ZoomIn size={18} />
                                </button>
                                <button
                                    type="button"
                                    className="btn btn--ghost"
                                    onClick={() => zoomOut(0.25)}
                                    title="Zoom -"
                                >
                                    <ZoomOut size={18} />
                                </button>
                                <span className="zoom-indicator">{zoomPercent}%</span>
                            </div>

                            <TransformComponent
                                wrapperClass="plan-viewer__viewport"
                                contentClass="plan-viewer__content"
                                wrapperStyle={{ width: '100%' }}
                            >
                                <div
                                    className="plan-viewer__canvas"
                                    onPointerDown={onCanvasPointerDown}
                                    onPointerUp={onCanvasPointerUp}
                                    onPointerCancel={onCanvasPointerCancel}
                                >
                                    <img
                                        src={imageDataUrl}
                                        alt="Plan"
                                        className="plan-viewer__image"
                                        draggable={false}
                                    />

                                    {/* Point markers */}
                                    {points.map((pt) => (
                                        <PinMarker
                                            key={pt.id}
                                            point={pt}
                                            isSelected={!!(selectedPointId === pt.id && isPanelOpen)}
                                            onPointerUp={(e) => onMarkerClick(pt, e)}
                                        />
                                    ))}
                                </div>
                            </TransformComponent>
                        </>
                    )}
                </TransformWrapper>
            </div>
        );
    }
);

PlanCanvas.displayName = 'PlanCanvas';
