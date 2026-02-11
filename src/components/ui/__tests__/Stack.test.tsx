import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Stack, Row, Column } from '../Stack';

describe('Stack Component', () => {
  it('renders children correctly', () => {
    render(
      <Stack>
        <div>Child 1</div>
        <div>Child 2</div>
      </Stack>
    );
    
    expect(screen.getByText('Child 1')).toBeInTheDocument();
    expect(screen.getByText('Child 2')).toBeInTheDocument();
  });

  it('applies flex direction column by default', () => {
    const { container } = render(<Stack>Content</Stack>);
    expect(container.firstChild).toHaveClass('flex-col');
  });

  it('applies flex direction row when specified', () => {
    const { container } = render(<Stack direction="row">Content</Stack>);
    expect(container.firstChild).toHaveClass('flex-row');
  });

  it('applies correct gap class', () => {
    const { container } = render(<Stack gap={4}>Content</Stack>);
    expect(container.firstChild).toHaveClass('gap-4');
  });

  it('applies alignment classes', () => {
    const { container } = render(
      <Stack align="center" justify="between">Content</Stack>
    );
    expect(container.firstChild).toHaveClass('items-center');
    expect(container.firstChild).toHaveClass('justify-between');
  });

  it('applies wrap class when specified', () => {
    const { container } = render(<Stack wrap>Content</Stack>);
    expect(container.firstChild).toHaveClass('flex-wrap');
  });

  it('combines custom className with defaults', () => {
    const { container } = render(<Stack className="custom-class">Content</Stack>);
    expect(container.firstChild).toHaveClass('flex');
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('applies inline styles', () => {
    const { container } = render(
      <Stack style={{ backgroundColor: 'red' }}>Content</Stack>
    );
    expect(container.firstChild).toHaveAttribute(
      'style',
      expect.stringContaining('background-color: red')
    );
  });
});

describe('Row Component', () => {
  it('renders with row direction', () => {
    const { container } = render(<Row>Content</Row>);
    expect(container.firstChild).toHaveClass('flex-row');
  });

  it('passes through all props', () => {
    const { container } = render(<Row gap={3} align="center">Content</Row>);
    expect(container.firstChild).toHaveClass('flex-row');
    expect(container.firstChild).toHaveClass('gap-3');
    expect(container.firstChild).toHaveClass('items-center');
  });
});

describe('Column Component', () => {
  it('renders with column direction', () => {
    const { container } = render(<Column>Content</Column>);
    expect(container.firstChild).toHaveClass('flex-col');
  });

  it('passes through all props', () => {
    const { container } = render(<Column gap={2} justify="center">Content</Column>);
    expect(container.firstChild).toHaveClass('flex-col');
    expect(container.firstChild).toHaveClass('gap-2');
    expect(container.firstChild).toHaveClass('justify-center');
  });
});
