import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LegionCrest from '../components/shared/LegionCrest';
import { supabase } from '../lib/supabase';
import { getAuthenticatedState, resolvePostAuthPath } from '../lib/auth';
import { syncProfileRankFromRoblox } from '../lib/robloxRanks';

const OAUTH_STATE_SESSION_KEY = 'roblox_oauth_state';

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }

  return fallback;
}

export default function LinkRobloxPage() {
  const navigate = useNavigate();
  const callbackHandledRef = useRef(false);
  const [linkedUsername, setLinkedUsername] = useState<string | null>(null);
  const [startingOauth, setStartingOauth] = useState(false);
  const [processingCallback, setProcessingCallback] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const generateOAuthState = () => {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
  };

  const startOauthRedirect = async () => {
    setError(null);
    setSuccess(null);
    setStartingOauth(true);

    try {
      const state = generateOAuthState();
      sessionStorage.setItem(OAUTH_STATE_SESSION_KEY, state);

      const redirectUri = `${window.location.origin}/link-roblox`;
      const response = await fetch('/api/roblox/oauth/authorize-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state,
          redirectUri
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.authorizeUrl) {
        throw new Error(payload?.message || 'Unable to start Roblox OAuth right now.');
      }

      window.location.assign(String(payload.authorizeUrl));
    } catch (startError) {
      setError(errorMessage(startError, 'Unable to start Roblox OAuth right now.'));
      setStartingOauth(false);
    }
  };

  useEffect(() => {
    let active = true;

    const hydrateProfile = async () => {
      const { profile } = await getAuthenticatedState();
      if (!active || !profile) {
        return;
      }

      if (profile.roblox_username) {
        setLinkedUsername(profile.roblox_username);
      }
    };

    void hydrateProfile();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (callbackHandledRef.current) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const code = String(params.get('code') || '').trim();
    const state = String(params.get('state') || '').trim();
    const oauthError = String(params.get('error') || '').trim();

    if (!code && !oauthError) {
      return;
    }

    callbackHandledRef.current = true;

    if (oauthError) {
      setError('Roblox OAuth was cancelled or denied. Please try again.');
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    const runCallback = async () => {
      setProcessingCallback(true);
      setError(null);
      setSuccess(null);

      try {
        const expectedState = String(sessionStorage.getItem(OAUTH_STATE_SESSION_KEY) || '').trim();
        if (!expectedState || !state || expectedState !== state) {
          throw new Error('OAuth state validation failed. Please try again.');
        }

        const response = await fetch('/api/roblox/oauth/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            state,
            redirectUri: `${window.location.origin}/link-roblox`
          })
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.verified) {
          throw new Error(payload?.message || 'Roblox OAuth callback failed. Please try again.');
        }

        const { session } = await getAuthenticatedState();
        if (!session?.user) {
          navigate('/login', { replace: true });
          return;
        }

        const robloxUsername = String(payload?.robloxUsername || linkedUsername || '').trim();
        const profileUpdatePayload: Record<string, string> = {
          roblox_id: String(payload.robloxId),
          roblox_verified_at: new Date().toISOString()
        };

        if (robloxUsername) {
          profileUpdatePayload.roblox_username = robloxUsername;
        }

        const { error: profileError } = await supabase
          .from('profiles')
          .update(profileUpdatePayload)
          .eq('id', session.user.id);

        if (profileError) {
          throw profileError;
        }

        sessionStorage.removeItem(OAUTH_STATE_SESSION_KEY);

        try {
          await syncProfileRankFromRoblox({
            profileId: session.user.id,
            robloxId: payload.robloxId ? String(payload.robloxId) : null,
            robloxUsername: robloxUsername || null
          });
        } catch (rankSyncError) {
          console.warn('Roblox rank auto-sync failed after OAuth linking', rankSyncError);
        }

        const nextPath = await resolvePostAuthPath();
        navigate(nextPath, { replace: true });
      } catch (callbackError) {
        console.error('Roblox OAuth callback handling failed', callbackError);
        setError(errorMessage(callbackError, 'Unable to complete Roblox sign-in. Please try again.'));
        sessionStorage.removeItem(OAUTH_STATE_SESSION_KEY);
      } finally {
        setProcessingCallback(false);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    };

    void runCallback();
  }, [linkedUsername, navigate]);

  const isBusy = startingOauth || processingCallback;

  return (
    <section className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-2xl rounded border border-slateBlue/70 bg-[#141a24] p-8">
        <div className="mb-4 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-silver/40 bg-slateBlue/30"><LegionCrest className="h-6 w-6 object-contain" /></div>
        </div>
        <div className="text-center text-[10px] uppercase tracking-[0.35em] text-slate-400">Verification</div>
        <h2 className="mt-2 text-center text-3xl font-semibold uppercase tracking-[0.2em] text-silver">Link Your Roblox Account</h2>
        <p className="mt-4 text-center text-slate-300">Use Roblox OAuth to securely link your account in one step.</p>

        <div className="mt-8 rounded border border-slateBlue/60 bg-[#0d121b] p-6 text-center">
          <div className="text-[10px] uppercase tracking-[0.3em] text-slate-400">OAuth Login</div>
          <p className="mt-3 text-sm text-slate-300">You will be redirected to Roblox to approve access, then returned here automatically.</p>
          {linkedUsername && (
            <p className="mt-3 text-xs text-slate-400">Current linked username: <span className="font-semibold text-silver">{linkedUsername}</span></p>
          )}
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => void startOauthRedirect()}
              disabled={isBusy}
              className="rounded border border-silver/50 bg-silver px-4 py-2 text-sm font-semibold uppercase tracking-[0.3em] text-slateBlue disabled:opacity-60"
            >
              {processingCallback ? 'Completing OAuth...' : startingOauth ? 'Redirecting...' : 'Sign in with Roblox'}
            </button>
            {error && (
              <button
                type="button"
                onClick={() => void startOauthRedirect()}
                disabled={isBusy}
                className="rounded border border-slateBlue/70 px-4 py-2 text-sm font-semibold uppercase tracking-[0.3em] text-silver disabled:opacity-60"
              >
                Try Again
              </button>
            )}
          </div>
        </div>
        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
        {success && <p className="mt-4 text-sm text-emerald-400">{success}</p>}
      </div>
    </section>
  );
}
