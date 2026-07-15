import { useState } from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function LoginPage() {
  const [status, setStatus] = useState('Preparing sign-in...');
  const [error, setError] = useState<string | null>(null);

  const handleDiscordLogin = async () => {
    setStatus('Redirecting to Discord...');
    setError(null);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: `${window.location.origin}/login`
      }
    });

    if (error) {
      setStatus('Unable to start the sign-in flow.');
      setError(error.message);
    }
  };

  return (
    <section className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-2xl rounded border border-slateBlue/70 bg-[#141a24] p-8 shadow-[0_0_30px_rgba(30,58,95,0.18)]">
        <div className="mb-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-silver/40 bg-slateBlue/30">
            <ShieldCheck className="h-8 w-8 text-silver" />
          </div>
        </div>
        <div className="text-center text-[10px] uppercase tracking-[0.35em] text-slate-400">Secure Channel</div>
        <h2 className="mt-2 text-center text-3xl font-semibold uppercase tracking-[0.2em] text-silver">Sign in with Discord</h2>
        <p className="mt-4 text-center text-slate-300">Access the roster, battles, schedule, and enlistment flow with your verified unit account.</p>
        <div className="mt-8 flex justify-center">
          <button onClick={handleDiscordLogin} className="flex items-center gap-2 rounded border border-[#5865F2] px-5 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-silver">
            <span>Sign in with Discord</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        {status && <p className="mt-4 text-center text-sm text-slate-400">{status}</p>}
        {error && <p className="mt-2 text-center text-sm text-red-400">{error}</p>}
        <p className="mt-6 text-center text-sm text-slate-400">First-time users verify their Roblox account once with a profile code after linking their Discord account.</p>
      </div>
    </section>
  );
}
