import { render, screen, fireEvent } from '@testing-library/react';
import { PlanActionBoard } from '../PlanActionBoard';
import { vi, describe, it, expect } from 'vitest';
import { ApiPlanPoint } from '../../../services/api';

const mockPoints: ApiPlanPoint[] = [
    {
        id: '1',
        planId: 'p1',
        positionX: 10,
        positionY: 10,
        title: 'Defaut Electricite',
        status: 'a_faire',
        pointNumber: 1,
        category: 'electricite',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        photoDataUrl: '',
        dateLabel: 'Aujourd\'hui'
    },
    {
        id: '2',
        planId: 'p1',
        positionX: 20,
        positionY: 20,
        title: 'Validation Peinture',
        status: 'termine',
        pointNumber: 2,
        category: 'validation',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        photoDataUrl: '',
        dateLabel: 'Aujourd\'hui'
    },
];

describe('PlanActionBoard', () => {
    const defaultProps = {
        currentPlanPoints: mockPoints,
        selectedPointId: null,
        isPanelOpen: false,
        onSelectPoint: vi.fn(),
        onAddPointClick: vi.fn(),
        onUpdateStatus: vi.fn(),
    };

    it('renders points in correct columns', () => {
        render(<PlanActionBoard {...defaultProps} />);

        // Check for point titles
        expect(screen.getByText('Defaut Electricite')).toBeInTheDocument();
        expect(screen.getByText('Validation Peinture')).toBeInTheDocument();

        // Check for column headers (implicit check via badge counts if possible, or just text)
        expect(screen.getByText('À faire')).toBeInTheDocument();
        expect(screen.getByText('Terminé')).toBeInTheDocument();
    });

    it('filters points by search query', () => {
        render(<PlanActionBoard {...defaultProps} />);

        const searchInput = screen.getByPlaceholderText(/rechercher/i);
        fireEvent.change(searchInput, { target: { value: 'Electricite' } });

        expect(screen.getByText('Defaut Electricite')).toBeInTheDocument();
        expect(screen.queryByText('Validation Peinture')).not.toBeInTheDocument();
    });

    it('calls onSelectPoint when a card is clicked', () => {
        render(<PlanActionBoard {...defaultProps} />);

        const card = screen.getByText('Defaut Electricite').closest('article');
        fireEvent.click(card!);

        expect(defaultProps.onSelectPoint).toHaveBeenCalledWith(mockPoints[0]);
    });

    it('filters by category', () => {
        render(<PlanActionBoard {...defaultProps} />);

        const select = screen.getByLabelText('Filtrer par catégorie'); // Verify aria-label or use getByRole('combobox')
        fireEvent.change(select, { target: { value: 'electricite' } });

        expect(screen.getByText('Defaut Electricite')).toBeInTheDocument();
        expect(screen.queryByText('Validation Peinture')).not.toBeInTheDocument();
    });
});
