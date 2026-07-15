import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import ApplyPage from './ApplyPage';

const insertApplication = vi.fn();

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: {
            user: {
              id: 'user-1',
              user_metadata: { user_name: 'discord-user', avatar_url: 'https://example.com/avatar.png' }
            }
          }
        },
        error: null
      }),
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1', user_metadata: { user_name: 'discord-user' } } }, error: null }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } }))
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'profile-1', roblox_username: 'RobloxUser', discord_username: '@discord-user' }, error: null })
        }))
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn().mockImplementation(async () => {
            insertApplication();
            return { data: { id: 'application-1' }, error: null };
          })
        }))
      }))
    }))
  }
}));

describe('ApplyPage', () => {
  beforeEach(() => {
    insertApplication.mockClear();
  });

  it('submits a new application with the authenticated profile and shows a confirmation', async () => {
    render(<ApplyPage />);

    fireEvent.change(screen.getByLabelText(/service number/i), { target: { value: 'PVT-1234' } });
    fireEvent.change(screen.getByLabelText(/timezone/i), { target: { value: 'CST' } });
    fireEvent.click(screen.getByRole('button', { name: /submit application/i }));

    await waitFor(() => expect(insertApplication).toHaveBeenCalled());
    expect(screen.getByText(/application submitted — pending hr review/i)).toBeInTheDocument();
  });
});
