import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LinkRobloxPage from './LinkRobloxPage';

const mockNavigate = vi.fn();
const mockGetAuthenticatedState = vi.fn();
const mockResolvePostAuthPath = vi.fn();
const profileUpdate = vi.fn();
const profileEq = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

vi.mock('../lib/auth', () => ({
  getAuthenticatedState: (...args: unknown[]) => mockGetAuthenticatedState(...args),
  resolvePostAuthPath: (...args: unknown[]) => mockResolvePostAuthPath(...args)
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      update: profileUpdate
    }))
  }
}));

describe('LinkRobloxPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockNavigate.mockReset();
    mockGetAuthenticatedState.mockReset();
    mockResolvePostAuthPath.mockReset();
    profileUpdate.mockReset();
    profileEq.mockReset();

    mockResolvePostAuthPath.mockResolvedValue('/');
    profileEq.mockResolvedValue({ error: null });
    profileUpdate.mockReturnValue({ eq: profileEq });

    mockGetAuthenticatedState.mockResolvedValue({
      session: { user: { id: 'user-1' } },
      profile: null,
      rosterEntry: null
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ authorizeUrl: 'https://apis.roblox.com/oauth/v1/authorize?client_id=abc' })
    } as Response);

    sessionStorage.clear();
    window.history.replaceState({}, '', '/link-roblox');
  });

  it('starts OAuth by requesting an authorize URL and redirecting the browser', async () => {
    render(
      <MemoryRouter>
        <LinkRobloxPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /sign in with roblox/i }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/roblox/oauth/authorize-url',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.any(String)
        })
      );
    });

    expect(sessionStorage.getItem('roblox_oauth_state')).toBeTruthy();
  });

  it('handles OAuth callback once and updates the linked profile', async () => {
    sessionStorage.setItem('roblox_oauth_state', 'state-1234567890abcd');
    window.history.replaceState({}, '', '/link-roblox?code=abc123&state=state-1234567890abcd');

    (globalThis.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ verified: true, robloxId: '999', robloxUsername: 'Builderman' })
      });

    render(
      <MemoryRouter>
        <LinkRobloxPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/roblox/oauth/callback',
        expect.objectContaining({ method: 'POST' })
      );
    });

    await waitFor(() => {
      expect(profileUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          roblox_id: '999',
          roblox_username: 'Builderman'
        })
      );
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
    });
  });
});
