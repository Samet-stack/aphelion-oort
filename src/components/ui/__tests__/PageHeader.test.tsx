import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageHeader } from '../PageHeader';
import { Building2, Plus } from 'lucide-react';

describe('PageHeader Component', () => {
  it('renders title correctly', () => {
    render(<PageHeader title="Test Title" />);
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('renders with icon', () => {
    render(<PageHeader title="Chantiers" icon={Building2} />);
    expect(screen.getByText('Chantiers')).toBeInTheDocument();
    // Icon is rendered as SVG
    expect(document.querySelector('svg')).toBeInTheDocument();
  });

  it('renders subtitle when provided', () => {
    render(
      <PageHeader 
        title="Test Title" 
        subtitle="This is a subtitle"
      />
    );
    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('This is a subtitle')).toBeInTheDocument();
  });

  it('renders children (actions)', () => {
    render(
      <PageHeader title="Test Title">
        <button type="button">Add New</button>
      </PageHeader>
    );
    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add New' })).toBeInTheDocument();
  });

  it('applies compact styles when compact prop is true', () => {
    const { container } = render(
      <PageHeader title="Compact Title" compact />
    );
    expect(container.querySelector('.page-header--compact')).toBeInTheDocument();
  });

  it('renders full layout with all props', () => {
    render(
      <PageHeader 
        title="Full Header" 
        icon={Plus}
        subtitle="With all features"
      >
        <button type="button">Action</button>
      </PageHeader>
    );
    
    expect(screen.getByText('Full Header')).toBeInTheDocument();
    expect(screen.getByText('With all features')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument();
  });
});
