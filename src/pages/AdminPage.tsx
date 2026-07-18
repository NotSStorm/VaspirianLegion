import { useEffect, useMemo, useState } from 'react';
import AssignmentSelect from '../components/shared/AssignmentSelect';
import { getAuthenticatedState } from '../lib/auth';
import { fetchExcludedPersonnelNames, normalizePersonnelName } from '../lib/personnel';
import { supabase } from '../lib/supabase';
import type { Role } from '../types';

type ProfileRecord = {
  id: string;
  role: Role;
  roblox_username?: string | null;
  discord_username?: string | null;
  callsign?: string | null;
  rank?: string | null;
  company?: string | null;
};

type RosterRecord = {
  profile_id: string;
  rank: string;
  company?: string | null;
  callsign?: string | null;
  profile?: ProfileRecord | ProfileRecord[] | null;
};

type PersonnelRecord = {
  roblox_username: string;
  rank?: string | null;
  unit?: string | null;
};

type BattleLogRecord = {
  participant_name: string;
  unit?: string | null;
  created_at?: string;
};

type AdminPersonRow = {
  key: string;
  displayName: string;
  robloxUsername: string;
  discordUsername: string;
  callsign: string;
  role: Role | null;
  unit: string;
  rank: string;
  profileId: string | null;
  rosterProfileId: string | null;
  personnelUsername: string | null;
  sources: string[];
};

const UNIT_OPTIONS = [
  { value: 'Unassigned', label: 'Unassigned' },
  { value: 'Battery Command', label: 'Battery Command' },
  { value: '82nd Pirkland', label: '82nd Pirkland' },
  { value: '87th Melrose', label: '87th Melrose' }
];

const ROLE_OPTIONS: Array<{ value: Role; label: string }> = [
  { value: 'member', label: 'Member' },
  { value: 'officer', label: 'Officer' },
  { value: 'admin', label: 'Admin' }
];

const RANK_OPTIONS = [
  'Unranked',
  'Conscript',
  'Soldat',
  'Musketier',
  'Fusilier',
  'Legionnaire',
  'Lance Corporal',
  'Corporal',
  'Sergeant',
  'Staff Sergeant',
  'Sergeant Major',
  'Ensign',
  'Sub-Lieutenant',
  'Lieutenant',
  'Captain',
  'Major',
  'Lieutenant Colonel',
  'Colonel'
];

function normalize(value?: string | null) {
  return normalizePersonnelName(value);
}

function buildAliases(values: Array<string | null | undefined>) {
  return values.map((value) => normalize(value)).filter(Boolean);
}

function resolveRosterProfile(profile: RosterRecord['profile']) {
  if (!profile) {
    return null;
  }

  if (Array.isArray(profile)) {
    return profile[0] || null;
  }

  return profile;
}

export default function AdminPage() {
  const [rows, setRows] = useState<AdminPersonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [viewerProfileId, setViewerProfileId] = useState<string | null>(null);

  const loadAdminRows = async () => {
    setLoading(true);
    setError(null);

    try {
      const { profile } = await getAuthenticatedState();
      setViewerProfileId(profile?.id || null);

      const excludedNames = await fetchExcludedPersonnelNames();

      const [{ data: profileData, error: profileError }, { data: rosterData, error: rosterError }, personnelResponse, { data: battleData, error: battleError }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, role, roblox_username, discord_username, callsign, rank, company')
          .order('created_at', { ascending: true }),
        supabase
          .from('roster')
          .select('profile_id, rank, company, callsign, profile:profiles!roster_profile_id_fkey(id, role, roblox_username, discord_username, callsign, rank, company)')
          .order('created_at', { ascending: true }),
        supabase
          .from('personnel')
          .select('roblox_username, rank, unit'),
        supabase
          .from('battle_stat_logs')
          .select('participant_name, unit, created_at')
          .order('created_at', { ascending: false })
      ]);

      if (profileError) throw profileError;
      if (rosterError) throw rosterError;
      if (battleError) throw battleError;
      if (personnelResponse.error && !/does not exist|relation/i.test(personnelResponse.error.message)) {
        throw personnelResponse.error;
      }

      const profiles = (profileData || []) as ProfileRecord[];
      const rosterRows = (rosterData || []) as RosterRecord[];
      const personnelRows = (personnelResponse.data || []) as PersonnelRecord[];
      const battleRows = (battleData || []) as BattleLogRecord[];

      const canonicalByAlias = new Map<string, string>();
      const profileByCanonical = new Map<string, ProfileRecord>();
      profiles.forEach((entry) => {
        const aliases = buildAliases([entry.roblox_username, entry.discord_username, entry.callsign]);
        if (aliases.some((alias) => excludedNames.has(alias))) {
          return;
        }

        const canonical = aliases[0] || `profile:${entry.id}`;
        profileByCanonical.set(canonical, entry);
        aliases.forEach((alias) => canonicalByAlias.set(alias, canonical));
      });

      const rosterByCanonical = new Map<string, RosterRecord>();
      rosterRows.forEach((entry) => {
        const profileEntry = resolveRosterProfile(entry.profile);
        const aliases = buildAliases([
          profileEntry?.roblox_username,
          profileEntry?.discord_username,
          profileEntry?.callsign,
          entry.callsign
        ]);
        if (aliases.some((alias) => excludedNames.has(alias))) {
          return;
        }

        const canonical = aliases.find((alias) => canonicalByAlias.has(alias))
          ? canonicalByAlias.get(aliases.find((alias) => canonicalByAlias.has(alias)) || '') as string
          : aliases[0] || `roster:${entry.profile_id}`;

        aliases.forEach((alias) => canonicalByAlias.set(alias, canonical));
        if (!rosterByCanonical.has(canonical)) {
          rosterByCanonical.set(canonical, entry);
        }
      });

      const personnelByCanonical = new Map<string, PersonnelRecord>();
      personnelRows.forEach((entry) => {
        const alias = normalize(entry.roblox_username);
        if (!alias || excludedNames.has(alias)) {
          return;
        }

        const canonical = canonicalByAlias.get(alias) || alias;
        canonicalByAlias.set(alias, canonical);
        if (!personnelByCanonical.has(canonical)) {
          personnelByCanonical.set(canonical, entry);
        }
      });

      const battleByCanonical = new Map<string, BattleLogRecord>();
      battleRows.forEach((entry) => {
        const alias = normalize(entry.participant_name);
        if (!alias || excludedNames.has(alias)) {
          return;
        }

        const canonical = canonicalByAlias.get(alias) || alias;
        canonicalByAlias.set(alias, canonical);
        if (!battleByCanonical.has(canonical)) {
          battleByCanonical.set(canonical, entry);
        }
      });

      const keys = new Set<string>([
        ...profileByCanonical.keys(),
        ...rosterByCanonical.keys(),
        ...personnelByCanonical.keys(),
        ...battleByCanonical.keys()
      ]);

      const mergedRows: AdminPersonRow[] = Array.from(keys).map((key) => {
        const profileEntry = profileByCanonical.get(key) || null;
        const rosterEntry = rosterByCanonical.get(key) || null;
        const personnelEntry = personnelByCanonical.get(key) || null;
        const battleEntry = battleByCanonical.get(key) || null;

        const displayName = String(
          profileEntry?.roblox_username
          || personnelEntry?.roblox_username
          || battleEntry?.participant_name
          || profileEntry?.discord_username
          || rosterEntry?.callsign
          || profileEntry?.callsign
          || key
        );

        const row: AdminPersonRow = {
          key,
          displayName,
          robloxUsername: String(profileEntry?.roblox_username || personnelEntry?.roblox_username || battleEntry?.participant_name || ''),
          discordUsername: String(profileEntry?.discord_username || ''),
          callsign: String(profileEntry?.callsign || rosterEntry?.callsign || ''),
          role: profileEntry?.role || null,
          unit: String(rosterEntry?.company || profileEntry?.company || personnelEntry?.unit || battleEntry?.unit || 'Unassigned'),
          rank: String(rosterEntry?.rank || profileEntry?.rank || personnelEntry?.rank || 'Unranked'),
          profileId: profileEntry?.id || rosterEntry?.profile_id || null,
          rosterProfileId: rosterEntry?.profile_id || null,
          personnelUsername: personnelEntry?.roblox_username || null,
          sources: [
            profileEntry ? 'profiles' : null,
            rosterEntry ? 'roster' : null,
            personnelEntry ? 'personnel' : null,
            battleEntry ? 'battle_stat_logs' : null
          ].filter((value): value is string => Boolean(value))
        };

        return row;
      });

      setRows(mergedRows.sort((left, right) => left.displayName.localeCompare(right.displayName)));
    } catch (loadError) {
      console.error('Unable to load admin personnel index', loadError);
      setError(loadError instanceof Error ? loadError.message : 'Unable to load admin panel data.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAdminRows();
  }, []);

  const visibleRows = useMemo(() => {
    const queryKey = query.trim().toLowerCase();
    if (!queryKey) {
      return [] as AdminPersonRow[];
    }

    return rows.filter((row) => [
      row.displayName,
      row.robloxUsername,
      row.discordUsername,
      row.callsign,
      row.rank,
      row.unit,
      row.sources.join(' ')
    ].join(' ').toLowerCase().includes(queryKey));
  }, [query, rows]);

  const refreshWithMessage = async (message: string) => {
    setSuccess(message);
    await loadAdminRows();
  };

  const updateRole = async (row: AdminPersonRow, role: Role) => {
    if (!row.profileId) {
      setError('Role can only be set for entries that have a profile row.');
      return;
    }

    setBusyKey(`role:${row.key}`);
    setError(null);
    setSuccess(null);

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ role })
        .eq('id', row.profileId);

      if (updateError) {
        throw updateError;
      }

      await refreshWithMessage(`Updated role for ${row.displayName}.`);
    } catch (updateError) {
      console.error('Unable to update role', updateError);
      setError(updateError instanceof Error ? updateError.message : 'Unable to update role.');
    } finally {
      setBusyKey(null);
    }
  };

  const updateUnit = async (row: AdminPersonRow, unit: string) => {
    const nextUnit = String(unit || '').trim() || 'Unassigned';
    setBusyKey(`unit:${row.key}`);
    setError(null);
    setSuccess(null);

    try {
      if (row.profileId) {
        await supabase.from('profiles').update({ company: nextUnit }).eq('id', row.profileId);
      }

      if (row.rosterProfileId || row.profileId) {
        const targetProfileId = row.rosterProfileId || row.profileId;
        await supabase.from('roster').update({ company: nextUnit }).eq('profile_id', targetProfileId);
      }

      const personnelUsername = row.personnelUsername || row.robloxUsername;
      if (personnelUsername) {
        await supabase
          .from('personnel')
          .upsert({
            roblox_username: personnelUsername,
            unit: nextUnit,
            rank: row.rank || 'Unranked',
            updated_at: new Date().toISOString()
          }, { onConflict: 'roblox_username' });
      }

      await refreshWithMessage(`Updated unit for ${row.displayName}.`);
    } catch (updateError) {
      console.error('Unable to update unit', updateError);
      setError(updateError instanceof Error ? updateError.message : 'Unable to update unit.');
    } finally {
      setBusyKey(null);
    }
  };

  const updateRank = async (row: AdminPersonRow, rank: string) => {
    const nextRank = String(rank || '').trim() || 'Unranked';
    setBusyKey(`rank:${row.key}`);
    setError(null);
    setSuccess(null);

    try {
      if (row.profileId) {
        await supabase.from('profiles').update({ rank: nextRank }).eq('id', row.profileId);
      }

      if (row.rosterProfileId || row.profileId) {
        const targetProfileId = row.rosterProfileId || row.profileId;
        await supabase.from('roster').update({ rank: nextRank }).eq('profile_id', targetProfileId);
      }

      const personnelUsername = row.personnelUsername || row.robloxUsername;
      if (personnelUsername) {
        await supabase
          .from('personnel')
          .upsert({
            roblox_username: personnelUsername,
            rank: nextRank,
            unit: row.unit || 'Unassigned',
            updated_at: new Date().toISOString()
          }, { onConflict: 'roblox_username' });
      }

      await refreshWithMessage(`Updated rank for ${row.displayName}.`);
    } catch (updateError) {
      console.error('Unable to update rank', updateError);
      setError(updateError instanceof Error ? updateError.message : 'Unable to update rank.');
    } finally {
      setBusyKey(null);
    }
  };

  const removeFromPersonnel = async (row: AdminPersonRow) => {
    const confirmed = window.confirm(`Remove ${row.displayName} from personnel tables and add to exclusions?`);
    if (!confirmed) {
      return;
    }

    setBusyKey(`remove:${row.key}`);
    setError(null);
    setSuccess(null);

    try {
      await supabase
        .from('personnel_exclusions')
        .upsert({
          normalized_name: row.key,
          display_name: row.displayName,
          reason: 'Removed from Personnel',
          created_by: viewerProfileId,
          updated_at: new Date().toISOString()
        }, { onConflict: 'normalized_name' });

      const candidateNames = new Set<string>();
      if (row.personnelUsername) {
        candidateNames.add(row.personnelUsername);
      }
      if (row.robloxUsername) {
        candidateNames.add(row.robloxUsername);
      }

      const { data: personnelRows } = await supabase
        .from('personnel')
        .select('roblox_username');
      (personnelRows || []).forEach((entry: any) => {
        const username = String(entry.roblox_username || '');
        if (normalize(username) === row.key) {
          candidateNames.add(username);
        }
      });

      const namesToDelete = Array.from(candidateNames);
      if (namesToDelete.length > 0) {
        await supabase
          .from('personnel')
          .delete()
          .in('roblox_username', namesToDelete);
      }

      const profileIds = Array.from(new Set([row.profileId, row.rosterProfileId].filter(Boolean))) as string[];
      if (profileIds.length > 0) {
        await supabase.from('roster').delete().in('profile_id', profileIds);
        await supabase.from('command_slots').update({ profile_id: null }).in('profile_id', profileIds);
      }

      await refreshWithMessage(`Removed ${row.displayName} from personnel tables and added exclusion.`);
    } catch (removeError) {
      console.error('Unable to remove personnel', removeError);
      setError(removeError instanceof Error ? removeError.message : 'Unable to remove personnel row.');
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <section className="space-y-6">
      <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
        <div className="text-[10px] uppercase tracking-[0.35em] text-slate-400">Admin Panel</div>
        <h2 className="mt-2 text-3xl font-semibold uppercase tracking-[0.2em] text-silver">Personnel Control</h2>
        <p className="mt-3 text-sm text-slate-300">
          Search across roster, personnel, battle logs, and profiles. Edit role, unit, and rank in one place.
        </p>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="mt-4 w-full rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver"
          placeholder="Search Roblox, Discord, callsign, rank, or source table"
        />
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        {success && <p className="mt-3 text-sm text-emerald-300">{success}</p>}
      </div>

      <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
        <div className="mb-4 text-[10px] uppercase tracking-[0.35em] text-slate-400">Search Results</div>
        {loading && <p className="text-sm text-slate-400">Loading personnel index...</p>}
        {!loading && !query.trim() && <p className="text-sm text-slate-400">Type a name to find personnel records.</p>}
        {!loading && query.trim() && visibleRows.length === 0 && <p className="text-sm text-slate-400">No matches for that search.</p>}
        <div className="space-y-4">
          {visibleRows.map((row) => {
            const roleBusy = busyKey === `role:${row.key}`;
            const rankBusy = busyKey === `rank:${row.key}`;
            const unitBusy = busyKey === `unit:${row.key}`;
            const removeBusy = busyKey === `remove:${row.key}`;
            const isBusy = Boolean(roleBusy || rankBusy || unitBusy || removeBusy);

            return (
              <div key={row.key} className="rounded border border-slateBlue/60 bg-[#0d121b] p-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-silver">{row.displayName}</div>
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Sources: {row.sources.join(', ')}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void removeFromPersonnel(row)}
                    disabled={isBusy}
                    className="rounded border border-red-500/50 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-red-300 disabled:opacity-60"
                  >
                    {removeBusy ? 'Removing...' : 'Remove from Personnel'}
                  </button>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-3">
                  <label className="text-xs text-slate-400">
                    Unit
                    <AssignmentSelect
                      value={row.unit || 'Unassigned'}
                      onChange={(nextUnit) => void updateUnit(row, nextUnit)}
                      disabled={isBusy}
                      options={UNIT_OPTIONS}
                      className="mt-1 w-full rounded border border-slateBlue/60 bg-[#141a24] px-3 py-2 text-sm text-silver"
                    />
                  </label>

                  <label className="text-xs text-slate-400">
                    Rank
                    <select
                      value={row.rank || 'Unranked'}
                      onChange={(event) => void updateRank(row, event.target.value)}
                      disabled={isBusy}
                      className="mt-1 w-full rounded border border-slateBlue/60 bg-[#141a24] px-3 py-2 text-sm text-silver"
                    >
                      {RANK_OPTIONS.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </label>

                  <label className="text-xs text-slate-400">
                    Role
                    <select
                      value={row.role || 'member'}
                      onChange={(event) => void updateRole(row, event.target.value as Role)}
                      disabled={isBusy || !row.profileId}
                      className="mt-1 w-full rounded border border-slateBlue/60 bg-[#141a24] px-3 py-2 text-sm text-silver"
                    >
                      {ROLE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="mt-3 text-xs text-slate-400">
                  Roblox: {row.robloxUsername || 'N/A'} • Discord: {row.discordUsername || 'N/A'} • Callsign: {row.callsign || 'N/A'}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
