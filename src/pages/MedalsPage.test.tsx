import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MedalsPage from './MedalsPage';

const getAuthenticatedStateMock = vi.fn();
const fromMock = vi.fn();

vi.mock('../lib/auth', () => ({
  getAuthenticatedState: () => getAuthenticatedStateMock()
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (...args: any[]) => fromMock(...args)
  }
}));

vi.mock('../components/shared/MedalCard', () => ({
  default: ({ medalName }: { medalName: string }) => <div>{medalName}</div>
}));

function makeMedals(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `medal-${index + 1}`,
    recipient_profile_id: 'profile-1',
    medal_name: `Medal ${index + 1}`,
    citation: '',
    campaign_tag: 'Campaign',
    date_awarded: `2026-07-${String((index % 28) + 1).padStart(2, '0')}`,
    status_tags: ['Declassified'],
    recipient: { roblox_username: 'Recipient One', discord_username: '@recipient-one' }
  }));
}

describe('MedalsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getAuthenticatedStateMock.mockResolvedValue({
      profile: { role: 'member' }
    });

    fromMock.mockImplementation((table: string) => {
      if (table === 'medals') {
        return {
          select: vi.fn(() => ({
            order: vi.fn().mockResolvedValue({ data: makeMedals(25), error: null })
          }))
        };
      }

      if (table === 'profiles') {
        return {
          select: vi.fn(() => ({
            order: vi.fn().mockResolvedValue({ data: [], error: null })
          }))
        };
      }

      if (table === 'medal_requests') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn().mockResolvedValue({ data: [], error: null })
            }))
          }))
        };
      }

      return {
        select: vi.fn().mockResolvedValue({ data: [], error: null })
      };
    });
  });

  it('shows medals in 12-item chunks each time the button is pushed', async () => {
    render(<MedalsPage />);

    await waitFor(() => {
      expect(screen.getByText(/medals & commendations/i)).toBeInTheDocument();
    });

    expect(screen.getByText('Medal 1')).toBeInTheDocument();
    expect(screen.getByText('Medal 12')).toBeInTheDocument();
    expect(screen.queryByText('Medal 13')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /show 12 more medals/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /show 12 more medals/i }));

    expect(screen.getByText('Medal 24')).toBeInTheDocument();
    expect(screen.queryByText('Medal 25')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /show 12 more medals/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /show 12 more medals/i }));

    expect(screen.getByText('Medal 25')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /show 12 more medals/i })).not.toBeInTheDocument();
  });
});
