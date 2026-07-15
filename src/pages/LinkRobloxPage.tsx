import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getAuthenticatedState, resolvePostAuthPath } from '../lib/auth';

function randomCode() {
  return `LEGION-${Math.floor(Math.random() * 0x1000000).toString(16).toUpperCase()}`;
}

export default function LinkRobloxPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [verificationCode, setVerificationCode] = useState<string | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [confirmingCode, setConfirmingCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const hydrateProfile = async () => {
      const { profile } = await getAuthenticatedState();
      if (!active || !profile) {
        return;
      }

      if (profile.roblox_username) {
        setUsername(profile.roblox_username);
      }

      if (profile.roblox_verification_code) {
        setVerificationCode(profile.roblox_verification_code);
      }
    };

    void hydrateProfile();

    return () => {
      active = false;
    };
  }, []);

  const handleGenerate = async () => {
    setError(null);
    setSuccess(null);
    setGeneratingCode(true);

    try {
      const trimmedUsername = username.trim();
      if (!trimmedUsername) {
        setError('Enter your Roblox username before requesting a code.');
        return;
      }

      setUsername(trimmedUsername);

      const { session } = await getAuthenticatedState();
      if (!session?.user) {
        navigate('/login', { replace: true });
        return;
      }

      const response = await fetch('/api/roblox/verify-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: trimmedUsername })
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.message || 'Unable to validate that Roblox username right now.');
      }

      if (!payload?.verified) {
        throw new Error(payload?.message || 'That Roblox username could not be validated.');
      }

      const nextCode = randomCode();
      const { error: profileError } = await supabase.from('profiles').update({
        roblox_verification_code: nextCode,
        roblox_username: trimmedUsername
      }).eq('id', session.user.id);

      if (profileError) {
        throw profileError;
      }

      setVerificationCode(nextCode);
      setSuccess('A fresh verification code has been saved to your profile.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate a verification code.');
    } finally {
      setGeneratingCode(false);
    }
  };

  const handleConfirm = async () => {
    setError(null);
    setSuccess(null);
    setConfirmingCode(true);

    try {
      const { session, profile } = await getAuthenticatedState();
      if (!session?.user) {
        navigate('/login', { replace: true });
        return;
      }

      const trimmedUsername = username.trim();
      const resolvedVerificationCode = profile?.roblox_verification_code || verificationCode;
      if (!trimmedUsername || !resolvedVerificationCode) {
        setError('Generate a code first and confirm your Roblox username.');
        return;
      }

      const response = await fetch('/api/roblox/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: trimmedUsername, code: resolvedVerificationCode })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.verified) {
        throw new Error(payload?.message || 'Code not found on your profile — make sure you saved it and try again');
      }

      const { error: profileError } = await supabase.from('profiles').update({
        roblox_id: payload.robloxId,
        roblox_username: trimmedUsername,
        roblox_verified_at: new Date().toISOString(),
        roblox_verification_code: resolvedVerificationCode
      }).eq('id', session.user.id);

      if (profileError) {
        throw profileError;
      }

      const nextPath = await resolvePostAuthPath();
      navigate(nextPath, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed.');
    } finally {
      setConfirmingCode(false);
    }
  };

  const handleUseDifferentAccount = () => {
    setVerificationCode(null);
    setError(null);
    setSuccess(null);
    setUsername('');
  };

  const handleGetNewCode = () => {
    setError(null);
    setSuccess(null);
    void handleGenerate();
  };

  const isBusy = generatingCode || confirmingCode;

  return (
    <section className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-2xl rounded border border-slateBlue/70 bg-[#141a24] p-8">
        <div className="mb-4 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-silver/40 bg-slateBlue/30"><ShieldCheck className="h-6 w-6 text-silver" /></div>
        </div>
        <div className="text-center text-[10px] uppercase tracking-[0.35em] text-slate-400">Verification</div>
        <h2 className="mt-2 text-center text-3xl font-semibold uppercase tracking-[0.2em] text-silver">Link Your Roblox Account</h2>
        <p className="mt-4 text-center text-slate-300">Enter your Roblox username, save the code to your profile bio, and confirm it here.</p>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div>
            <label htmlFor="roblox-username" className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">Your Roblox Username</label>
            <input id="roblox-username" value={username} onChange={(e) => setUsername(e.target.value)} className="mt-2 w-full rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-silver" />
            <div className="mt-4 flex flex-wrap gap-3">
              <button type="button" onClick={handleGetNewCode} disabled={isBusy} className="rounded border border-silver/50 bg-silver px-4 py-2 text-sm font-semibold uppercase tracking-[0.3em] text-slateBlue disabled:opacity-60">{generatingCode ? 'Generating...' : 'Get My Code'}</button>
              <button type="button" onClick={handleUseDifferentAccount} disabled={isBusy} className="rounded border border-slateBlue/70 px-4 py-2 text-sm font-semibold uppercase tracking-[0.3em] text-silver disabled:opacity-60">Use a different Roblox account</button>
            </div>
          </div>
          <div className="rounded border border-slateBlue/60 bg-[#0d121b] p-4">
            <div className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Verification Code</div>
            <div className="mt-2 rounded border border-silver/30 bg-slateBlue/20 p-3 font-mono text-lg text-silver">{verificationCode ?? 'Generate a code to begin'}</div>
            <p className="mt-4 text-sm text-slate-300">Paste this code into your Roblox profile About section, save it, and confirm.</p>
            <button type="button" onClick={handleConfirm} disabled={isBusy} className="mt-4 rounded border border-slateBlue/70 px-4 py-2 text-sm font-semibold uppercase tracking-[0.3em] text-silver disabled:opacity-60">{confirmingCode ? 'Confirming...' : 'Confirm'}</button>
          </div>
        </div>
        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
        {success && <p className="mt-4 text-sm text-emerald-400">{success}</p>}
      </div>
    </section>
  );
}
