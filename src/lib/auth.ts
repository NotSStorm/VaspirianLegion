import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Profile, RosterEntry } from '../types';

export interface AuthState {
  session: Session | null;
  profile: Profile | null;
  rosterEntry: RosterEntry | null;
}

async function getExistingProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();

  if (error && !/does not exist|relation/i.test(error.message)) {
    throw error;
  }

  return data as Profile | null;
}

async function getExistingRosterEntry(userId: string): Promise<RosterEntry | null> {
  const { data, error } = await supabase.from('roster').select('*').eq('profile_id', userId).maybeSingle();

  if (error && !/does not exist|relation/i.test(error.message)) {
    throw error;
  }

  return data as RosterEntry | null;
}

export async function ensureProfileForSession(session: Session | null): Promise<Profile | null> {
  if (!session?.user) {
    return null;
  }

  const user = session.user;
  const existingProfile = await getExistingProfile(user.id);
  const profilePayload = {
    id: user.id,
    discord_id: user.user_metadata?.provider_id ?? user.id,
    discord_username: user.user_metadata?.user_name ?? user.user_metadata?.preferred_username ?? user.user_metadata?.global_name ?? user.user_metadata?.name ?? user.email ?? 'discord-user',
    role: existingProfile?.role ?? 'member',
    roblox_username: existingProfile?.roblox_username ?? null,
    callsign: existingProfile?.callsign ?? null,
    rank: existingProfile?.rank ?? null,
    company: existingProfile?.company ?? null,
    roblox_verification_code: existingProfile?.roblox_verification_code ?? null,
    roblox_verified_at: existingProfile?.roblox_verified_at ?? null
  };

  const { data, error } = await supabase.from('profiles').upsert(profilePayload, { onConflict: 'id' }).select('*').single();

  if (error) {
    throw error;
  }

  return data as Profile;
}

export async function getAuthenticatedState(): Promise<AuthState> {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError || !session?.user) {
    return { session: null, profile: null, rosterEntry: null };
  }

  const [profile, rosterEntry] = await Promise.all([
    ensureProfileForSession(session),
    getExistingRosterEntry(session.user.id)
  ]);

  return { session, profile, rosterEntry };
}

export async function resolvePostAuthPath(): Promise<string> {
  const { profile, rosterEntry } = await getAuthenticatedState();

  if (!profile) {
    return '/login';
  }

  if (!profile.roblox_username) {
    return '/link-roblox';
  }

  if (!rosterEntry) {
    return '/enlist/apply';
  }

  return '/';
}

export async function verifyMinimumGroupRank(profile: Profile | null): Promise<{ verified: boolean; checked: boolean; message: string }> {
  if (!profile?.roblox_username) {
    return { verified: false, checked: false, message: 'Pending verification' };
  }

  try {
    const response = await fetch('/api/roblox/verify-rank', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        robloxUsername: profile.roblox_username,
        groupUrl: 'https://www.roblox.com/communities/5531725/Andouran-Empire'
      })
    });

    if (!response.ok) {
      return { verified: false, checked: true, message: 'Verification pending' };
    }

    const payload = await response.json();
    return {
      verified: Boolean(payload?.verified),
      checked: true,
      message: payload?.message ?? 'Verification pending'
    };
  } catch {
    return { verified: false, checked: true, message: 'Verification pending' };
  }
}
