import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BattlesPage from './BattlesPage';

const getAuthenticatedStateMock = vi.fn();
const fromMock = vi.fn();

vi.mock('../lib/auth', () => ({
  getAuthenticatedState: () => getAuthenticatedStateMock()
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (...args: any[]) => fromMock(...args),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } })
    }
  }
}));

vi.mock('../lib/personnel', () => ({
  fetchExcludedPersonnelNames: vi.fn().mockResolvedValue(new Set()),
  normalizePersonnelName: (value: string) => String(value || '').trim().toLowerCase()
}));

function makeBattles(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `battle-${index + 1}`,
    name: `Battle ${index + 1}`,
    classification: 'EU',
    status: 'Completed',
    theater: 'N/A',
    commanding_officer: `CO ${index + 1}`,
    personnel_count: 10 + index,
    start_date: `2026-07-${String(20 - index).padStart(2, '0')}`,
    threat_level: index,
    description: 'Test battle'
  }));
}

describe('BattlesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getAuthenticatedStateMock.mockResolvedValue({
      profile: { role: 'member' },
      session: { user: { id: 'user-1' } }
    });

    fromMock.mockImplementation((table: string) => {
      if (table === 'battles') {
        return {
          select: vi.fn(() => ({
            order: vi.fn().mockResolvedValue({ data: makeBattles(6), error: null })
          }))
        };
      }

      if (table === 'battle_stat_logs') {
        return {
          select: vi.fn(() => ({
            order: vi.fn().mockResolvedValue({ data: [], error: null })
          }))
        };
      }

      if (table === 'roster') {
        return {
          select: vi.fn().mockResolvedValue({ data: [], error: null })
        };
      }

      return {
        select: vi.fn().mockResolvedValue({ data: [], error: null })
      };
    });
  });

  it('shows only 4 battles by default and reveals older battles on toggle', async () => {
    render(<BattlesPage />);

    await waitFor(() => {
      expect(screen.getByText(/battles ledger/i)).toBeInTheDocument();
    });

    expect(screen.getAllByRole('button', { name: /view logs/i })).toHaveLength(4);
    expect(screen.getByRole('button', { name: /show past battles/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /show past battles/i }));

    expect(screen.getAllByRole('button', { name: /view logs/i })).toHaveLength(6);
    expect(screen.getByRole('button', { name: /hide past battles/i })).toBeInTheDocument();
  });
});
