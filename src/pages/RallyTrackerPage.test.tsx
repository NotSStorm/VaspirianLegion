import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RallyTrackerPage from './RallyTrackerPage';

const fromMock = vi.fn();
const channelMock = vi.fn();

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (...args: any[]) => fromMock(...args),
    channel: (...args: any[]) => channelMock(...args),
    removeChannel: vi.fn().mockResolvedValue(null)
  }
}));

describe('RallyTrackerPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    channelMock.mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis()
    });

    fromMock.mockImplementation((table: string) => {
      if (table === 'battle_stat_logs') {
        return {
          select: vi.fn().mockResolvedValue({ data: [], error: null })
        };
      }

      return {
        select: vi.fn().mockResolvedValue({ data: [], error: null })
      };
    });
  });

  it('uses a sliding 7-day weekly window based on battle start_date', async () => {
    const recentDate = new Date();
    recentDate.setUTCDate(recentDate.getUTCDate() - 1);
    const oldDate = new Date();
    oldDate.setUTCDate(oldDate.getUTCDate() - 10);

    const recentIso = recentDate.toISOString();
    const oldIso = oldDate.toISOString();
    const recentDay = recentIso.slice(0, 10);
    const oldDay = oldIso.slice(0, 10);

    fromMock.mockImplementation((table: string) => {
      if (table === 'battle_stat_logs') {
        return {
          select: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'log-recent',
                battle_id: 'battle-recent',
                participant_name: 'Alpha',
                unit: '87th Melrose',
                kills: 1,
                deaths: 0,
                assists: 2,
                created_at: oldIso,
                battles: {
                  start_date: recentDay
                }
              },
              {
                id: 'log-old',
                battle_id: 'battle-old',
                participant_name: 'Bravo',
                unit: '82nd Pirkland',
                kills: 2,
                deaths: 1,
                assists: 0,
                created_at: recentIso,
                battles: {
                  start_date: oldDay
                }
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

    render(<RallyTrackerPage />);

    expect(await screen.findByText(recentDay)).toBeInTheDocument();
    expect(screen.queryByText(oldDay)).not.toBeInTheDocument();
  });
});
