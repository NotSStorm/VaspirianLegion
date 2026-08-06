import { supabase } from './supabase';

const DEFAULT_GROUP_ID = '5531725';

type UserRankResponse = {
  rank?: string;
  found?: boolean;
};

export async function fetchRobloxGroupRank(robloxId?: string | null, robloxUsername?: string | null, groupId = DEFAULT_GROUP_ID) {
  try {
    if (!robloxId && !robloxUsername) {
      return null;
    }

    const response = await fetch('/api/roblox/user-rank', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ robloxId, robloxUsername, groupId })
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json().catch(() => ({} as UserRankResponse));
    const rank = String(payload?.rank || '').trim();
    return rank || null;
  } catch {
    return null;
  }
}

export async function syncProfileRankFromRoblox(input: {
  profileId: string;
  robloxId?: string | null;
  robloxUsername?: string | null;
  groupId?: string;
}) {
  const rank = await fetchRobloxGroupRank(input.robloxId, input.robloxUsername, input.groupId || DEFAULT_GROUP_ID);
  if (!rank) {
    return null;
  }

  const { error } = await supabase
    .from('profiles')
    .update({ rank })
    .eq('id', input.profileId);

  if (error) {
    throw error;
  }

  return rank;
}
