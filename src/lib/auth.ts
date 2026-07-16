import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Profile, RosterEntry } from '../types';

export interface AuthState {
  session: Session | null;
  profile: Profile | null;
  rosterEntry: RosterEntry | null;
}

function getProfileDisplayName(session: Session | null) {
  return session?.user.user_metadata?.user_name
    ?? session?.user.user_metadata?.preferred_username
    ?? session?.user.user_metadata?.global_name
    ?? session?.user.user_metadata?.name
    ?? session?.user.email
    ?? 'discord-user';
}

async function getExistingProfile(userId: string): Promise<Profile | null> {
  try {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();

    if (error) {
      if (/does not exist|relation/i.test(error.message)) {
        return null;
      }
      console.error('Profile lookup failed', error);
      throw error;
    }

    return data as Profile | null;
  } catch (error) {
    console.error('Profile lookup crashed', error);
    throw error;
  }
}

async function getExistingRosterEntry(userId: string): Promise<RosterEntry | null> {
  try {
    const { data, error } = await supabase.from('roster').select('*').eq('profile_id', userId).maybeSingle();

    if (error) {
      if (/does not exist|relation/i.test(error.message)) {
        return null;
      }
      console.error('Roster lookup failed', error);
      throw error;
    }

    return data as RosterEntry | null;
  } catch (error) {
    console.error('Roster lookup crashed', error);
    throw error;
  }
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
    discord_username: getProfileDisplayName(session),
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
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      console.error('Session lookup failed', sessionError);
      return { session: null, profile: null, rosterEntry: null };
    }

    if (!session?.user) {
      return { session: null, profile: null, rosterEntry: null };
    }

    try {
      const [profile, rosterEntry] = await Promise.all([
        ensureProfileForSession(session),
        getExistingRosterEntry(session.user.id)
      ]);

      return { session, profile, rosterEntry };
    } catch (error) {
      console.error('Profile bootstrap failed; keeping active session', error);
      return { session, profile: null, rosterEntry: null };
    }
  } catch (error) {
    console.error('Authenticated-state resolution failed', error);
    return { session: null, profile: null, rosterEntry: null };
  }
}

export function resolveRouteForAuthState(profile: Profile | null, rosterEntry: RosterEntry | null): string {
  if (!profile) {
    return '/link-roblox';
  }

  if (!profile.roblox_username) {
    return '/link-roblox';
  }

  if (profile.role === 'admin' || profile.role === 'officer') {
    return '/admin';
  }

  if (!rosterEntry) {
    return '/enlist/apply';
  }

  return '/';
}

export async function resolvePostAuthPath(): Promise<string> {
  try {
    const { profile, rosterEntry } = await getAuthenticatedState();
    return resolveRouteForAuthState(profile, rosterEntry);
  } catch (error) {
    console.error('Post-auth redirect failed', error);
    return '/link-roblox';
  }
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
