import { useEffect, useMemo, useState } from 'react';
import PersonnelTable from '../components/shared/PersonnelTable';
import { getAuthenticatedState } from '../lib/auth';
import { supabase } from '../lib/supabase';

const GROUP_ID = '5531725';
const roleCache = new Map<string, string>();
const idByUsernameCache = new Map<string, string>();

async function resolveRobloxIdByUsername(username?: string | null) {
  const normalized = String(username || '').trim();
  if (!normalized) return null;
  if (idByUsernameCache.has(normalized)) return idByUsernameCache.get(normalized) as string;

  try {
    const response = await fetch('https://users.roblox.com/v1/usernames/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernames: [normalized], excludeBannedUsers: false })
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json().catch(() => ({}));
    const first = Array.isArray(payload?.data) ? payload.data[0] : null;
    if (!first?.id) {
      return null;
    }

    const resolved = String(first.id);
    idByUsernameCache.set(normalized, resolved);
    return resolved;
  } catch {
    return null;
  }
}

async function resolveGroupRank(robloxId?: string | null, robloxUsername?: string | null, fallbackRank = 'Unknown') {
  let resolvedId = robloxId || null;
  if (!resolvedId) {
    resolvedId = await resolveRobloxIdByUsername(robloxUsername);
  }

  if (!resolvedId) return fallbackRank;
  if (roleCache.has(resolvedId)) return roleCache.get(resolvedId) as string;

  try {
    const response = await fetch(`https://groups.roblox.com/v1/users/${encodeURIComponent(resolvedId)}/groups/roles`);
    if (!response.ok) {
      roleCache.set(resolvedId, fallbackRank);
      return fallbackRank;
    }

    const payload = await response.json().catch(() => ({}));
    const groupRole = Array.isArray(payload?.data)
      ? payload.data.find((entry: any) => String(entry?.group?.id) === GROUP_ID)
      : null;
    const resolved = groupRole?.role?.name ? String(groupRole.role.name) : fallbackRank;
    roleCache.set(resolvedId, resolved);
    return resolved;
  } catch {
    roleCache.set(resolvedId, fallbackRank);
    return fallbackRank;
  }
}

type PersonnelRow = {
  combinedName: string;
  unit: string;
  groupRank: string;
  medals: string[];
};

type RosterRecord = {
  id?: string;
  profile_id: string;
  rank: string;
  company?: string | null;
  profile?: {
    roblox_username?: string | null;
    roblox_id?: string | null;
    discord_username?: string | null;
  } | null;
};

export default function PersonnelPage() {
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<PersonnelRow[]>([]);
  const [rosterRows, setRosterRows] = useState<RosterRecord[]>([]);
  const [isStaff, setIsStaff] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [syncingRanks, setSyncingRanks] = useState(false);

  const loadPersonnel = async () => {
    setLoading(true);

    try {
      const { profile } = await getAuthenticatedState();
      setIsStaff(profile?.role === 'admin' || profile?.role === 'officer');

      const { data: rosterData, error: rosterError } = await supabase
        .from('roster')
        .select('id, profile_id, rank, company, profile:profiles!roster_profile_id_fkey(roblox_username, roblox_id, discord_username)')
        .order('created_at', { ascending: true });

      if (rosterError) {
        throw rosterError;
      }

      const profileIds = (rosterData || []).map((entry: any) => entry.profile_id);
      const { data: medalData } = await supabase
        .from('medals')
        .select('recipient_profile_id, medal_name')
        .in('recipient_profile_id', profileIds.length ? profileIds : ['00000000-0000-0000-0000-000000000000']);

      const medalsByProfile = new Map<string, string[]>();
      (medalData || []).forEach((medal: any) => {
        const recipientProfileId = String(medal.recipient_profile_id || '');
        if (!recipientProfileId) {
          return;
        }
        const existing = medalsByProfile.get(recipientProfileId) || [];
        medalsByProfile.set(recipientProfileId, [...existing, String(medal.medal_name)]);
      });

      const resolvedRows = await Promise.all(
        ((rosterData || []) as RosterRecord[]).map(async (entry) => {
          const robloxName = entry.profile?.roblox_username || entry.profile?.discord_username || 'Unknown';
          const groupRank = await resolveGroupRank(entry.profile?.roblox_id, entry.profile?.roblox_username, entry.rank || 'Unranked');

          return {
            combinedName: `${groupRank} - ${robloxName}`,
            unit: entry.company || 'Unassigned',
            groupRank,
            medals: medalsByProfile.get(entry.profile_id) || []
          };
        })
      );

      setRows(resolvedRows);
      setRosterRows((rosterData || []) as RosterRecord[]);
    } catch (error) {
      console.error('Personnel roster load failed', error);
      setRows([]);
      setRosterRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPersonnel();
  }, []);

  const visibleRows = useMemo(
    () => rows.filter((row) => [row.combinedName, row.unit, row.groupRank, row.medals.join(' ')].join(' ').toLowerCase().includes(query.toLowerCase())),
    [query, rows]
  );

  const updateRosterField = async (entry: RosterRecord, patch: Partial<RosterRecord>) => {
    setActiveProfileId(entry.profile_id);
    try {
      const { error } = await supabase
        .from('roster')
        .update({
          company: patch.company === undefined ? entry.company : patch.company,
          rank: patch.rank === undefined ? entry.rank : patch.rank
        })
        .eq('profile_id', entry.profile_id);

      if (error) {
        throw error;
      }

      setRosterRows((previous) => previous.map((row) => (
        row.profile_id === entry.profile_id ? { ...row, ...patch } : row
      )));
    } catch (updateError) {
      console.error('Roster update failed', updateError);
    } finally {
      setActiveProfileId(null);
    }
  };

  const syncRanksFromRobloxGroup = async () => {
    setSyncingRanks(true);
    try {
      for (const entry of rosterRows) {
        const resolvedRank = await resolveGroupRank(entry.profile?.roblox_id, entry.profile?.roblox_username, entry.rank || 'Unranked');
        if (resolvedRank && resolvedRank !== entry.rank) {
          const { error } = await supabase
            .from('roster')
            .update({ rank: resolvedRank })
            .eq('profile_id', entry.profile_id);

          if (error) {
            throw error;
          }
        }
      }

      await loadPersonnel();
    } catch (syncError) {
      console.error('Rank sync failed', syncError);
    } finally {
      setSyncingRanks(false);
    }
  };

  return (
    <section className="space-y-6">
      <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.35em] text-slate-400">Personnel Ledger</div>
            <h2 className="mt-2 text-3xl font-semibold uppercase tracking-[0.2em] text-silver">Roster</h2>
          </div>
          <input value={query} onChange={(e) => setQuery(e.target.value)} className="rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver" placeholder="Search by username or rank" />
        </div>
      </div>

      <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
        <div className="mb-4 text-[10px] uppercase tracking-[0.35em] text-slate-400">Command</div>
        {loading ? <p className="text-sm text-slate-400">Loading accepted personnel...</p> : <PersonnelTable rows={visibleRows} />}
      </div>

      {isStaff && (
        <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="text-[10px] uppercase tracking-[0.35em] text-slate-400">Personnel Management</div>
            <button
              type="button"
              onClick={() => void syncRanksFromRobloxGroup()}
              disabled={syncingRanks}
              className="rounded border border-slateBlue/70 px-3 py-2 text-xs uppercase tracking-[0.3em] text-slate-300 disabled:opacity-60"
            >
              {syncingRanks ? 'Syncing Group Ranks...' : 'Sync Ranks from Roblox Group'}
            </button>
          </div>
          <h3 className="text-lg font-semibold uppercase tracking-[0.3em] text-silver">Assign Unit and Rank</h3>
          <div className="mt-4 space-y-3">
            {rosterRows.map((entry) => {
              const displayName = entry.profile?.roblox_username || entry.profile?.discord_username || entry.profile_id;
              const busy = activeProfileId === entry.profile_id;

              return (
                <div key={entry.profile_id} className="grid gap-2 rounded border border-slateBlue/60 p-3 lg:grid-cols-[1.4fr_1fr_1fr]">
                  <div className="text-sm font-semibold text-silver">{displayName}</div>
                  <label className="text-xs text-slate-400">
                    Unit
                    <select
                      value={entry.company || ''}
                      onChange={(event) => void updateRosterField(entry, { company: event.target.value })}
                      disabled={busy}
                      className="mt-1 w-full rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver"
                    >
                      <option value="Battery Command">Battery Command</option>
                      <option value="82nd Pirkland">82nd Pirkland</option>
                      <option value="87th Melrose">87th Melrose</option>
                    </select>
                  </label>
                  <label className="text-xs text-slate-400">
                    Rank
                    <input
                      value={entry.rank || ''}
                      onChange={(event) => setRosterRows((previous) => previous.map((row) => row.profile_id === entry.profile_id ? { ...row, rank: event.target.value } : row))}
                      onBlur={(event) => {
                        const value = event.target.value.trim() || 'SSGT';
                        if (value !== entry.rank) {
                          void updateRosterField(entry, { rank: value });
                        }
                      }}
                      className="mt-1 w-full rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver"
                    />
                  </label>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
