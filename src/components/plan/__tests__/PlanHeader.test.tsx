import { render, screen, fireEvent } from '@testing-library/react';
import { PlanHeader } from '../PlanHeader';
import { vi, describe, it, expect } from 'vitest';

describe('PlanHeader', () => {
    const defaultProps = {
        planName: 'Test Plan',
        siteName: 'Test Site',
        onBack: vi.fn(),
        zoomIn: vi.fn(),
        zoomOut: vi.fn(),
        resetTransform: vi.fn(),
        zoomPercent: 100,
    };

    it('renders plan name and site name correctly', () => {
        render(<PlanHeader {...defaultProps} />);
        expect(screen.getByText('Test Plan')).toBeInTheDocument();
        expect(screen.getByText('Test Site')).toBeInTheDocument();
        expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('calls onBack handler when back button is clicked', () => {
        render(<PlanHeader {...defaultProps} />);
        const backButton = screen.getByText(/retour/i);
        fireEvent.click(backButton);
        expect(defaultProps.onBack).toHaveBeenCalled();
    });

    it('calls zoom handlers interaction', () => {
        render(<PlanHeader {...defaultProps} />);

        const zoomInBtn = screen.getByTitle('Zoomer');
        fireEvent.click(zoomInBtn);
        expect(defaultProps.zoomIn).toHaveBeenCalled();

        const zoomOutBtn = screen.getByTitle('Dézoomer');
        fireEvent.click(zoomOutBtn);
        expect(defaultProps.zoomOut).toHaveBeenCalled();

        const resetBtn = screen.getByTitle('Réinitialiser');
        fireEvent.click(resetBtn);
        expect(defaultProps.resetTransform).toHaveBeenCalled();
    });
});
