import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hero } from '../Hero';
import { sitesApi, type ApiSiteListItem } from '../../services/api';

vi.mock('../../services/api', () => ({
  sitesApi: {
    getAll: vi.fn(),
  },
}));

vi.mock('../../config/branding', () => ({
  branding: {
    logoUrl: '',
  },
}));

const buildSite = (id: string, hoursAgo: number): ApiSiteListItem => ({
  id,
  siteName: `Site ${id}`,
  address: `${id} street`,
  plansCount: 2,
  pointsCount: 6,
  createdAt: new Date(Date.now() - (hoursAgo + 24) * 3600 * 1000).toISOString(),
  updatedAt: new Date(Date.now() - hoursAgo * 3600 * 1000).toISOString(),
});

describe('Hero', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens featured and compact sites with contextual ids', async () => {
    vi.mocked(sitesApi.getAll).mockResolvedValue([
      buildSite('older', 40),
      buildSite('recent', 1),
      buildSite('second', 5),
      buildSite('third', 8),
    ]);

    const onStart = vi.fn();
    const onHistory = vi.fn();
    const user = userEvent.setup();

    render(<Hero onStart={onStart} onHistory={onHistory} />);

    const featuredButton = await screen.findByRole('button', { name: /priorité du jour/i });
    await user.click(featuredButton);
    expect(onStart).toHaveBeenNthCalledWith(1, 'recent');

    const compactButton = screen.getByRole('button', { name: /site second/i });
    await user.click(compactButton);
    expect(onStart).toHaveBeenNthCalledWith(2, 'second');
  });

  it('keeps only 5 recent sites visible and main CTA opens generic flow', async () => {
    vi.mocked(sitesApi.getAll).mockResolvedValue([
      buildSite('one', 1),
      buildSite('two', 2),
      buildSite('three', 3),
      buildSite('four', 4),
      buildSite('five', 5),
      buildSite('six', 100),
    ]);

    const onStart = vi.fn();
    const onHistory = vi.fn();
    const user = userEvent.setup();

    render(<Hero onStart={onStart} onHistory={onHistory} />);

    await screen.findByText('Site one');
    expect(screen.getByText('Site five')).toBeInTheDocument();
    expect(screen.queryByText('Site six')).not.toBeInTheDocument();

    const mainButton = screen.getByRole('button', { name: /nouveau chantier/i });
    await user.click(mainButton);
    expect(onStart).toHaveBeenCalledWith();
  });
});
