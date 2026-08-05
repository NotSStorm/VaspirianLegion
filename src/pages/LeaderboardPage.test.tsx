import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LeaderboardPage from './LeaderboardPage';

const fromMock = vi.fn();
const channelMock = vi.fn();

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (...args: any[]) => fromMock(...args),
    channel: (...args: any[]) => channelMock(...args),
    removeChannel: vi.fn().mockResolvedValue(null)
  }
}));

describe('LeaderboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    channelMock.mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis()
    });

    fromMock.mockImplementation((table: string) => {
      if (table === 'battle_stat_logs') {
        return {
          select: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'log-1',
                battle_id: 'battle-1',
                participant_name: 'High Score Player',
                unit: '82nd Pirkland',
                kills: 18,
                deaths: 2,
                assists: 4,
                created_at: '2026-08-05T12:00:00Z'
              }
            ],
            error: null
          })
        };
      }

      if (table === 'battles') {
        return {
          select: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'battle-1',
                start_date: '2026-08-05'
              }
            ],
            error: null
          })
        };
      }

      return {
        select: vi.fn().mockResolvedValue({ data: [], error: null })
      };
    });
  });

  it('shows the battle date in the high score rankings', async () => {
    render(<LeaderboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/leaderboard/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /high scores/i }));

    await waitFor(() => {
      expect(screen.getAllByText(/date: 2026-08-05/i)).toHaveLength(3);
    });
  });
});
