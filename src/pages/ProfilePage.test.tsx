import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import ProfilePage from './ProfilePage';

const fetchMock = vi.fn();

vi.mock('../lib/auth', () => ({
  getAuthenticatedState: vi.fn().mockResolvedValue({
    session: { user: { email: 'member@example.com' } },
    profile: {
      id: 'profile-1',
      roblox_id: '123',
      roblox_username: 'Lurac_Case',
      callsign: 'Battery Lead',
      rank: 'CST',
      company: 'Battery Command'
    }
  })
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'roster') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { rank: 'CST', group_rank: null, company: 'Battery Command' },
                error: null
              })
            }))
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

      if (table === 'battles') {
        return {
          select: vi.fn(() => ({
            order: vi.fn().mockResolvedValue({ data: [], error: null })
          }))
        };
      }

      return { select: vi.fn() };
    })
  }
}));

describe('ProfilePage', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
  });

  it('does not mirror internal rank when group rank is unavailable', async () => {
    render(<ProfilePage />);

    await waitFor(() => expect(screen.getByText(/member profile/i)).toBeInTheDocument());
    expect(screen.getByText(/not yet synced/i)).toBeInTheDocument();
    expect(screen.queryByText(/^CST$/i)).toBeNull();
  });
});