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
      json: async () => ({ verified: true, robloxId: 123 })
    } as Response);
  });

  it('keeps the entered username and shows a generated code when Get My Code is clicked', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    render(
      <MemoryRouter>
        <LinkRobloxPage />
      </MemoryRouter>
    );

    const usernameInput = screen.getByLabelText(/your roblox username/i);
    fireEvent.change(usernameInput, { target: { value: 'Builderman' } });
    fireEvent.click(screen.getByRole('button', { name: /get my code/i }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/roblox/verify-username',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'Builderman' })
        })
      );
    });

    await waitFor(() => {
      expect(profileUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          roblox_username: 'Builderman',
          roblox_verification_code: 'LEGION-800000'
        })
      );
    });

    expect((usernameInput as HTMLInputElement).value).toBe('Builderman');
    expect(screen.getByText('LEGION-800000')).toBeInTheDocument();
  });

  it('shows an error message when code generation fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'Unable to validate that Roblox username right now.' })
    } as Response);

    render(
      <MemoryRouter>
        <LinkRobloxPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/your roblox username/i), { target: { value: 'Builderman' } });
    fireEvent.click(screen.getByRole('button', { name: /get my code/i }));

    expect(await screen.findByText(/unable to validate that roblox username right now/i)).toBeInTheDocument();
    expect(screen.getByText(/generate a code to begin/i)).toBeInTheDocument();
  });
});
