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
      if (table === 'battles') {
        return {
          select: vi.fn(() => ({
            order: vi.fn().mockResolvedValue({ data: [], error: null })
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

      return {
        select: vi.fn().mockResolvedValue({ data: [], error: null })
      };
    });
  });

  it('shows a reload button at the bottom of the page', async () => {
    render(<RallyTrackerPage />);

    expect(await screen.findByRole('button', { name: /reload battle logs/i })).toBeInTheDocument();
  });
});
