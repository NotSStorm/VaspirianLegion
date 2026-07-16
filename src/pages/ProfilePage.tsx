import { useEffect, useMemo, useState } from 'react';
import { Shield } from 'lucide-react';
import { getAuthenticatedState } from '../lib/auth';
import { supabase } from '../lib/supabase';

const GROUP_ID = '5531725';

type HeaderProfile = {
  discordUsername: string;
  robloxUsername: string | null;
  robloxId: string | null;
  callsign: string | null;
  rank: string | null;
  company: string | null;
  groupRank: string | null;
};

type RosterRecord = {
  rank: string;
  company?: string | null;
};

type BattleStatLog = {
  id: string;
  battle_id: string;
  participant_name: string;
  kills: number;
  deaths: number;
  assists: number;
  created_at: string;
};

type Battle = {
  id: string;
  name: string;
  start_date: string;
};

type PeakStat = {
  label: string;
  value: number;
  battleName: string;
  date: string;
};

function normalizeName(value?: string | null) {
  return String(value || '').trim().replace(/[_\s]+/g, '').toLowerCase();
}

async function resolveRobloxId(robloxId?: string | null, robloxUsername?: string | null) {
  if (robloxId) {
    return robloxId;
  }

  const normalized = String(robloxUsername || '').trim();
  if (!normalized) {
    return null;
  }

  try {
    const lookupResponse = await fetch('https://users.roblox.com/v1/usernames/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernames: [normalized], excludeBannedUsers: false })
    });

    if (!lookupResponse.ok) {
      return null;
    }

    const payload = await lookupResponse.json().catch(() => ({}));
    const first = Array.isArray(payload?.data) ? payload.data[0] : null;
    return first?.id ? String(first.id) : null;
  } catch {
    return null;
  }
}

async function resolveGroupRank(robloxId?: string | null, robloxUsername?: string | null, fallbackRank = 'Unranked') {
  const resolvedId = await resolveRobloxId(robloxId, robloxUsername);
  if (!resolvedId) {
    return fallbackRank;
  }

  try {
    const response = await fetch(`https://groups.roblox.com/v1/users/${encodeURIComponent(resolvedId)}/groups/roles`);
    if (!response.ok) {
      return fallbackRank;
    }

    const payload = await response.json().catch(() => ({}));
    const groupRole = Array.isArray(payload?.data)
      ? payload.data.find((entry: any) => String(entry?.group?.id) === GROUP_ID)
      : null;
    return groupRole?.role?.name ? String(groupRole.role.name) : fallbackRank;
  } catch {
    return fallbackRank;
  }
}

async function loadAvatarUrl(robloxId?: string | null, robloxUsername?: string | null) {
  const resolvedId = await resolveRobloxId(robloxId, robloxUsername);
  if (!resolvedId) {
    return null;
  }

  try {
    const response = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${encodeURIComponent(resolvedId)}&size=150x150&format=Png&isCircular=true`);
    if (!response.ok) {
      return `https://www.roblox.com/headshot-thumbnail/image?userId=${encodeURIComponent(resolvedId)}&width=150&height=150&format=png`;
    }

    const payload = await response.json().catch(() => ({}));
    const first = Array.isArray(payload?.data) ? payload.data[0] : null;
    return first?.imageUrl
      ? String(first.imageUrl)
      : `https://www.roblox.com/headshot-thumbnail/image?userId=${encodeURIComponent(resolvedId)}&width=150&height=150&format=png`;
  } catch {
    return `https://www.roblox.com/headshot-thumbnail/image?userId=${encodeURIComponent(resolvedId)}&width=150&height=150&format=png`;
  }
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<HeaderProfile | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [logs, setLogs] = useState<BattleStatLog[]>([]);
  const [battlesById, setBattlesById] = useState<Map<string, Battle>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      setLoading(true);
      setError(null);

      try {
        const { session, profile: authProfile } = await getAuthenticatedState();
        if (!session?.user || !authProfile) {
          if (active) {
            setProfile(null);
            setLogs([]);
            setBattlesById(new Map());
          }
          return;
        }

        const { data: rosterRow } = await supabase
          .from('roster')
          .select('rank, company')
          .eq('profile_id', authProfile.id)
          .maybeSingle();

        const resolvedGroupRank = await resolveGroupRank(
          authProfile.roblox_id || null,
          authProfile.roblox_username || null,
          (rosterRow as RosterRecord | null)?.rank || authProfile.rank || 'Unranked'
        );

        const currentProfile = {
          discordUsername: authProfile.discord_username || session.user.email || 'signed-in-user',
          robloxUsername: authProfile.roblox_username || null,
          robloxId: authProfile.roblox_id || null,
          callsign: authProfile.callsign || null,
          rank: (rosterRow as RosterRecord | null)?.rank || authProfile.rank || null,
          company: (rosterRow as RosterRecord | null)?.company || authProfile.company || null,
          groupRank: resolvedGroupRank
        };

        const aliases = [authProfile.roblox_username, authProfile.discord_username, authProfile.callsign]
          .map((value) => normalizeName(value))
          .filter(Boolean);

        const [{ data: statData, error: statError }, { data: battleData, error: battleError }] = await Promise.all([
          supabase.from('battle_stat_logs').select('id, battle_id, participant_name, kills, deaths, assists, created_at'),
          supabase.from('battles').select('id, name, start_date')
        ]);

        if (statError) throw statError;
        if (battleError) throw battleError;

        const filteredLogs = ((statData || []) as BattleStatLog[]).filter((entry) => aliases.includes(normalizeName(entry.participant_name)));
        const battleMap = new Map<string, Battle>();
        ((battleData || []) as Battle[]).forEach((battle) => battleMap.set(battle.id, battle));
        const resolvedAvatarUrl = await loadAvatarUrl(currentProfile.robloxId, currentProfile.robloxUsername);

        if (!active) {
          return;
        }

        setProfile(currentProfile);
        setLogs(filteredLogs);
        setBattlesById(battleMap);
        setAvatarUrl(resolvedAvatarUrl);
      } catch (loadErr) {
        if (!active) {
          return;
        }
        setError(loadErr instanceof Error ? loadErr.message : 'Unable to load profile.');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadProfile();

    return () => {
      active = false;
    };
  }, []);

  const careerTotals = useMemo(() => logs.reduce((accumulator, entry) => ({
    kills: accumulator.kills + (Number(entry.kills) || 0),
    deaths: accumulator.deaths + (Number(entry.deaths) || 0),
    assists: accumulator.assists + (Number(entry.assists) || 0)
  }), { kills: 0, deaths: 0, assists: 0 }), [logs]);

  const peakStats = useMemo<PeakStat[]>(() => {
    const withBattleContext = logs.map((entry) => {
      const battle = battlesById.get(entry.battle_id);
      return {
        ...entry,
        battleName: battle?.name || 'Unknown Battle',
        date: battle?.start_date || entry.created_at.slice(0, 10)
      };
    });

    const buildPeak = (label: string, field: 'kills' | 'deaths' | 'assists'): PeakStat => {
      const best = withBattleContext.reduce<typeof withBattleContext[number] | null>((current, entry) => {
        if (!current || Number(entry[field]) > Number(current[field])) {
          return entry;
        }
        return current;
      }, null);

      return {
        label,
        value: best ? Number(best[field]) || 0 : 0,
        battleName: best?.battleName || 'No logged battle',
        date: best?.date || 'N/A'
      };
    };

    return [
      buildPeak('Most Kills In One Battle', 'kills'),
      buildPeak('Most Deaths In One Battle', 'deaths'),
      buildPeak('Most Assists In One Battle', 'assists')
    ];
  }, [logs, battlesById]);

  return (
    <section className="space-y-6">
      <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
        <div className="text-[10px] uppercase tracking-[0.35em] text-slate-400">Member Profile</div>
        <h2 className="mt-2 text-3xl font-semibold uppercase tracking-[0.2em] text-silver">Operational Record</h2>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </div>

      {loading ? (
        <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6 text-sm text-slate-400">Loading profile...</div>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
            <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
              <div className="flex flex-col items-center text-center">
                <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border border-slateBlue/60 bg-[#0d121b]">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Roblox avatar" className="h-full w-full object-cover" />
                  ) : (
                    <Shield className="h-12 w-12 text-slate-400" />
                  )}
                </div>
                <div className="mt-4 text-xl font-semibold uppercase tracking-[0.2em] text-silver">{profile?.robloxUsername || profile?.discordUsername || 'Member'}</div>
                <div className="mt-2 text-sm text-slate-300">{profile?.groupRank || profile?.rank || 'Unranked'}{profile?.company ? ` • ${profile.company}` : ''}</div>
                {profile?.callsign && <div className="mt-1 text-xs uppercase tracking-[0.3em] text-slate-400">{profile.callsign}</div>}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded border border-slateBlue/70 bg-[#141a24] p-5">
                <div className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Career Kills</div>
                <div className="mt-2 font-mono text-3xl font-semibold text-silver">{careerTotals.kills}</div>
              </div>
              <div className="rounded border border-slateBlue/70 bg-[#141a24] p-5">
                <div className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Career Deaths</div>
                <div className="mt-2 font-mono text-3xl font-semibold text-silver">{careerTotals.deaths}</div>
              </div>
              <div className="rounded border border-slateBlue/70 bg-[#141a24] p-5">
                <div className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Career Assists</div>
                <div className="mt-2 font-mono text-3xl font-semibold text-silver">{careerTotals.assists}</div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {peakStats.map((stat) => (
              <div key={stat.label} className="rounded border border-slateBlue/70 bg-[#141a24] p-5">
                <div className="text-[10px] uppercase tracking-[0.3em] text-slate-400">{stat.label}</div>
                <div className="mt-2 font-mono text-3xl font-semibold text-silver">{stat.value}</div>
                <div className="mt-3 text-sm text-slate-300">{stat.battleName}</div>
                <div className="mt-1 text-xs uppercase tracking-[0.3em] text-slate-400">{stat.date}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}