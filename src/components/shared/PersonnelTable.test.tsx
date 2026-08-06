import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PersonnelTable from './PersonnelTable';

describe('PersonnelTable', () => {
  it('shows the medal overflow popup only on hover and lets it escape the table bounds', async () => {
    render(
      <PersonnelTable
        rows={[
          {
            combinedName: 'Test Unit Member',
            unit: 'Alpha',
            groupRank: 'Captain',
            medals: ['MEDAL ONE', 'MEDAL TWO', 'MEDAL THREE', 'MEDAL FOUR', 'MEDAL FIVE', 'MEDAL SIX']
          }
        ]}
      />
    );

    expect(screen.getByTitle('MEDAL ONE')).toBeInTheDocument();
    expect(screen.getByTitle('MEDAL FIVE')).toBeInTheDocument();
    expect(screen.queryByTitle('MEDAL SIX')).not.toBeInTheDocument();

    const overflowButton = screen.getByRole('button', { name: /\+1/ });
    expect(screen.queryByText('MEDAL SIX')).not.toBeInTheDocument();

    fireEvent.mouseEnter(overflowButton);
    expect(screen.getByText('MEDAL SIX')).toBeInTheDocument();

    fireEvent.mouseLeave(overflowButton);

    await waitFor(() => {
      expect(screen.queryByText('MEDAL SIX')).not.toBeInTheDocument();
    });
  });

  it('formats veneration medals and keeps medal popup internally scrollable', () => {
    render(
      <PersonnelTable
        rows={[
          {
            combinedName: 'Veneration Holder',
            unit: 'Alpha',
            groupRank: 'Captain',
            medals: ['ORDER OF THE GOLD GRIFFIN', 'VEN 60', 'VEN 18', 'VEN 36', 'VEN 24', 'VEN 48']
          }
        ]}
      />
    );

    const overflowButton = screen.getByRole('button', { name: /\+1/ });
    fireEvent.mouseEnter(overflowButton);

    expect(screen.getAllByText('Veneration - 5 Years').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Veneration - 18 Months').length).toBeGreaterThan(0);
    expect(screen.queryByText('VEN 60')).not.toBeInTheDocument();

    const medalMenuList = screen.getByTestId('medal-menu-list');
    expect(medalMenuList.className).toContain('max-h-[70vh]');
    expect(medalMenuList.className).toContain('overflow-y-auto');
  });
});
