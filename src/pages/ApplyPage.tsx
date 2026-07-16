import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { verifyMinimumGroupRank } from '../lib/auth';
import type { Profile } from '../types';

const TIMEZONE_PATTERN = /^(UTC|GMT|EST|EDT|CST|CDT|MST|MDT|PST|PDT|[A-Z]{2,4}|[A-Za-z]+(?:\/[A-Za-z_]+)*)$/;

function normalizeDiscordName(raw?: string | null) {
  const value = raw?.trim() ?? '';
  return value.startsWith('@') ? value : `@${value}`;
}

function resolveErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }

  return fallback;
}

export default function ApplyPage() {
  const [timezone, setTimezone] = useState('');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [verification, setVerification] = useState<{ verified: boolean; checked: boolean; message: string }>({
    verified: false,
    checked: false,
    message: 'Pending verification'
  });

  useEffect(() => {
    let mounted = true;

    const loadProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user || !mounted) {
        return;
      }

      const fallbackProfile: Profile = {
        id: session.user.id,
        discord_username: session.user.user_metadata?.user_name ?? session.user.user_metadata?.preferred_username ?? session.user.user_metadata?.name ?? session.user.email ?? 'discord-user',
        roblox_username: undefined,
        role: 'member'
      };
      setProfile(fallbackProfile);

      const { data, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
      if (!mounted) {
        return;
      }

      if (!error && data) {
        const resolvedProfile = { ...fallbackProfile, ...data } as Profile;
        setProfile(resolvedProfile);
        setVerification(await verifyMinimumGroupRank(resolvedProfile));
        return;
      }

      setVerification(await verifyMinimumGroupRank(fallbackProfile));
    };

    void loadProfile();

    return () => {
      mounted = false;
    };
  }, []);

  const callsign = useMemo(() => profile?.roblox_username ?? 'Unlinked', [profile]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setErrors({});
    setMessage(null);

    let resolvedProfile = profile;
    if (!resolvedProfile?.id) {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setErrors({ profile: 'You must sign in before submitting.' });
        return;
      }

      const fallbackProfile: Profile = {
        id: session.user.id,
        discord_username: session.user.user_metadata?.user_name ?? session.user.user_metadata?.preferred_username ?? session.user.user_metadata?.name ?? session.user.email ?? 'discord-user',
        roblox_username: undefined,
        role: 'member'
      };
      resolvedProfile = fallbackProfile;
      setProfile(fallbackProfile);
    }

    const nextErrors: Record<string, string> = {};
    const normalizedTimezone = timezone.trim().toUpperCase();
    if (!normalizedTimezone || !TIMEZONE_PATTERN.test(normalizedTimezone)) {
      nextErrors.timezone = 'Enter a valid timezone such as EST, CST, MST, PST, or GMT.';
    }
    if (!resolvedProfile?.id) {
      nextErrors.profile = 'You must sign in before submitting.';
    }

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('applications').insert({
        profile_id: resolvedProfile!.id,
        service_number: `APP-${Date.now().toString(36).toUpperCase()}`,
        callsign: callsign,
        timezone: normalizedTimezone,
        requested_group_join: true,
        status: 'pending'
      }).select('*').single();

      if (error) {
        throw error;
      }

      setSubmitted(true);
      setMessage('Application submitted — pending HR review.');
    } catch (error) {
      console.error('Application submission failed', error);
      const message = resolveErrorMessage(error, 'Unable to submit your application.');
      const friendlyMessage = /network|fetch|timeout/i.test(message)
        ? 'The request failed because of a network issue. Please try again.'
        : /not authenticated|jwt|session/i.test(message)
          ? 'You need to be signed in before submitting an application.'
          : message;
      setErrors({ submit: friendlyMessage });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="rounded border border-slateBlue/70 bg-[#141a24] p-8">
        <div className="text-[10px] uppercase tracking-[0.35em] text-slate-400">[ Enlistment ]</div>
        <h2 className="mt-2 text-3xl font-semibold uppercase tracking-[0.2em] text-silver">Enlistment / Re-enlistment</h2>
        <p className="mt-4 text-slate-300">A new application is queued for review and does not immediately grant membership.</p>

        <div className="mt-6 rounded border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
          <div className="font-semibold uppercase tracking-[0.3em]">Request to Join the Battery</div>
          <p className="mt-2">Please join the <a href="https://www.roblox.com/communities/5531725/Andouran-Empire" className="text-silver underline" target="_blank" rel="noreferrer">Andouran Empire</a> or <a href="https://www.roblox.com/communities/432773563/FUIRST-KEISARIKS-ARM-CORPS" className="text-silver underline" target="_blank" rel="noreferrer">Fuirst Keisariks Arm Corps</a> community before applying.</p>
        </div>

        {submitted ? (
          <div className="mt-6 rounded border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            <div className="font-semibold uppercase tracking-[0.3em]">Application submitted</div>
            <p className="mt-2">{message ?? 'Your application is pending HR review.'}</p>
          </div>
        ) : (
          <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
            <div className="rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-3 text-sm text-slate-300">
              <div className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Roblox Username</div>
              <div className="mt-2 font-semibold text-silver">{callsign}</div>
            </div>
            <label htmlFor="timezone">
              <div className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Timezone</div>
              <input id="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} className="mt-2 w-full rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-silver" placeholder="e.g. EST, CST, GMT" />
              {errors.timezone && <p className="mt-2 text-sm text-red-400">{errors.timezone}</p>}
            </label>
            {errors.profile && <p className="text-sm text-red-400">{errors.profile}</p>}
            {errors.submit && <p className="text-sm text-red-400">{errors.submit}</p>}
            <button disabled={submitting} className="rounded border border-silver/50 bg-silver px-4 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-slateBlue disabled:cursor-not-allowed disabled:opacity-60">
              {submitting ? 'Submitting...' : 'Submit Application'}
            </button>
          </form>
        )}
      </div>

      <div className="space-y-6">
        <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-silver/40 bg-slateBlue/30"><ShieldCheck className="h-5 w-5 text-silver" /></div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Recruit</div>
              <div className="font-semibold text-silver">{profile?.roblox_username ?? 'Roblox Username'}</div>
            </div>
          </div>
          <div className="mt-4 space-y-3 text-sm text-slate-300">
            <div className="rounded border border-slateBlue/60 p-3"><div className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Status</div><div className="font-semibold text-silver">Applicant</div></div>
            <div className="rounded border border-slateBlue/60 p-3"><div className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Discord</div><div className="font-semibold text-silver">{normalizeDiscordName(profile?.discord_username)}</div></div>
          </div>
        </div>

        <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
          <h3 className="text-lg font-semibold uppercase tracking-[0.3em] text-silver">Verification Checklist</h3>
          <ul className="mt-4 space-y-3 text-sm text-slate-300">
            <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" />Discord linked</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" />In unit Discord server</li>
            <li className="flex items-center gap-2">{verification.verified ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <CheckCircle2 className="h-4 w-4 text-amber-400" />}{verification.checked ? verification.message : 'Minimum group rank met'}</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
