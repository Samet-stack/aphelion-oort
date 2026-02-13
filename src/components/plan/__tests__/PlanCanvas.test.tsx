import { render, screen, fireEvent } from '@testing-library/react';
import { PlanCanvas } from '../PlanCanvas';
import { vi, describe, it, expect } from 'vitest';
import { ApiPlanPoint } from '../../../services/api';

// Mock react-zoom-pan-pinch
vi.mock('react-zoom-pan-pinch', () => ({
    TransformWrapper: ({ children }: any) => (
        <div data-testid="transform-wrapper">
            {typeof children === 'function'
                ? children({ zoomIn: vi.fn(), zoomOut: vi.fn(), resetTransform: vi.fn() })
                : children}
        </div>
    ),
    TransformComponent: ({ children }: any) => <div data-testid="transform-component">{children}</div>,
}));

const mockPoints: ApiPlanPoint[] = [
    {
        id: '1',
        planId: 'p1',
        positionX: 50,
        positionY: 50,
        title: 'Point 1',
        status: 'a_faire',
        pointNumber: 1,
        category: 'default',
        createdAt: '',
        updatedAt: '',
        photoDataUrl: '',
        dateLabel: 'Aujourd\'hui'
    }
];

describe('PlanCanvas', () => {
    const defaultProps = {
        imageDataUrl: 'data:image/png;base64,fake',
        points: mockPoints,
        zoomPercent: 100,
        selectedPointId: undefined,
        isPanelOpen: false,
        onInit: vi.fn(),
        onZoomChange: vi.fn(),
        onGestureStart: vi.fn(),
        onGestureEnd: vi.fn(),
        onCanvasPointerDown: vi.fn(),
        onCanvasPointerUp: vi.fn(),
        onCanvasPointerCancel: vi.fn(),
        onMarkerClick: vi.fn(),
    };

    it('renders the plan image', () => {
        render(<PlanCanvas {...defaultProps} />);
        const img = screen.getByAltText('Plan');
        expect(img).toBeInTheDocument();
        expect(img).toHaveAttribute('src', 'data:image/png;base64,fake');
    });

    it('renders markers correctly', () => {
        render(<PlanCanvas {...defaultProps} />);
        expect(screen.getByText('1')).toBeInTheDocument(); // The point number inside the marker
    });

    it('handles marker click', () => {
        render(<PlanCanvas {...defaultProps} />);
        const marker = screen.getByText('1').closest('div'); // Assuming the number is inside the marker div
        fireEvent.pointerDown(marker!, { button: 0 }); // Simulate interaction if needed, or just standard click/pointer events depending on implementation
        // Since PlanCanvas uses pointer events extensively, let's trigger the click behavior if it's bound to onClick/onPointerUp
        // Looking at implementation: <div ... onPointerUp={(e) => onMarkerClick(point, e)} ... >

        fireEvent.pointerUp(marker!);
        expect(defaultProps.onMarkerClick).toHaveBeenCalled();
    });
});
