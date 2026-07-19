import { useEffect, useMemo, useState } from 'react';
import PersonnelManagementPanel from '../components/shared/PersonnelManagementPanel';
import PersonnelTable from '../components/shared/PersonnelTable';
import { getAuthenticatedState } from '../lib/auth';
import { fetchExcludedPersonnelNames, normalizePersonnelName, syncBattleLogUnitsForAliases } from '../lib/personnel';
import { supabase } from '../lib/supabase';

const GROUP_ID = '5531725';
const ALLOWED_GROUP_RANKS = [
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
] as const;

const RANK_INDEX_BY_KEY = new Map<string, number>(
  ALLOWED_GROUP_RANKS.map((rank, index) => [rank.toLowerCase(), index])
);

const RANK_ALIASES: Record<string, string> = {
  ssgt: 'Staff Sergeant',
  'staff sergeant': 'Staff Sergeant',
  sgt: 'Sergeant',
  cpl: 'Corporal',
  lcpl: 'Lance Corporal',
  'lt colonel': 'Lieutenant Colonel',
  'lieutenant colonel': 'Lieutenant Colonel',
  'sub lieutenant': 'Sub-Lieutenant'
};

const HIGH_RANK_PATTERN = /\bgeneral\b|brigadier|field marshal|marshal|admiral/i;

type BulkSyncResponse = {
  groupId: string;
  totalRequested: number;
  uniqueRequested: number;
  usernamesResolved: number;
  unresolvedUsernames: string[];
  roleLookupFailures: string[];
  rankByUsername: Record<string, string>;
  synced?: number;
  failed?: string[];
  message?: string;
};

type SyncSummary = {
  totalRosterRows: number;
  totalPersonnelRows: number;
  totalPersonnelDirectoryRows: number;
  rowsWithUsableUsername: number;
  uniqueUsernamesChecked: number;
  usernamesResolved: number;
  usernamesUnresolved: string[];
  roleLookupFailures: string[];
  rosterRanksUpdated: number;
  rosterRanksUnchanged: number;
  personnelRanksUpdated: number;
  personnelRanksUnchanged: number;
  failedProfileUpdates: string[];
  failedPersonnelUpdates: string[];
  skippedMissingUsername: number;
};


type PersonnelRow = {
  key: string;
  profileId: string | null;
  username: string;
  combinedName: string;
  unit: string;
  groupRank: string;
  medals: string[];
};

type PersonnelSourceRow = PersonnelRow & {
  key: string;
  priority: number;
};

type BattleLogParticipant = {
  participant_name: string;
  unit: string;
};

type ProfileRecord = {
  id: string;
  rank?: string | null;
  company?: string | null;
  roblox_username?: string | null;
  roblox_id?: string | null;
  discord_username?: string | null;
  callsign?: string | null;
};

type RosterRecord = {
  id?: string;
  profile_id: string;
  rank: string;
  callsign?: string | null;
  company?: string | null;
  profile?: {
    roblox_username?: string | null;
    roblox_id?: string | null;
    discord_username?: string | null;
    callsign?: string | null;
  } | null;
};

type PersonnelDirectoryRecord = {
  roblox_username: string;
  rank?: string | null;
  unit?: string | null;
};

export default function PersonnelPage() {
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<PersonnelRow[]>([]);
  const [rosterRows, setRosterRows] = useState<RosterRecord[]>([]);
  const [isStaff, setIsStaff] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncingRanks, setSyncingRanks] = useState(false);
  const [syncSummary, setSyncSummary] = useState<SyncSummary | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [personnelDirectoryRows, setPersonnelDirectoryRows] = useState<PersonnelDirectoryRecord[]>([]);
  const [activeUnitKey, setActiveUnitKey] = useState<string | null>(null);

  const normalizeName = (value?: string | null) => normalizePersonnelName(value);

  const sanitizeGroupRank = (value?: string | null) => {
    const raw = String(value || '').trim();
    if (!raw) {
      return 'Unranked';
    }

    const aliasResolved = RANK_ALIASES[raw.toLowerCase()] || raw;
    const allowedIndex = RANK_INDEX_BY_KEY.get(aliasResolved.toLowerCase());
    if (allowedIndex === undefined) {
      return raw;
    }

    return ALLOWED_GROUP_RANKS[allowedIndex];
  };

  const isRosterEligibleRank = (value?: string | null) => {
    const raw = String(value || '').trim();
    if (!raw) {
      return true;
    }

    const aliasResolved = RANK_ALIASES[raw.toLowerCase()] || raw;
    if (HIGH_RANK_PATTERN.test(aliasResolved)) {
      return false;
    }

    return true;
  };

  const normalizeSyncedRank = (value?: string | null) => {
    const raw = String(value || '').trim();
    if (!raw) {
      return null;
    }

    const aliasResolved = RANK_ALIASES[raw.toLowerCase()] || raw;
    const allowedIndex = RANK_INDEX_BY_KEY.get(aliasResolved.toLowerCase());
    if (allowedIndex === undefined) {
      return 'Unranked';
    }

    return ALLOWED_GROUP_RANKS[allowedIndex];
  };

  const shouldSkipUnrankedOverwrite = (existingRank?: string | null, incomingRank?: string | null) => {
    const normalizedIncoming = String(incomingRank || '').trim().toLowerCase();
    if (normalizedIncoming !== 'unranked') {
      return false;
    }

    const normalizedExisting = String(existingRank || '').trim().toLowerCase();
    return normalizedExisting.length > 0 && normalizedExisting !== 'unranked';
  };

  const getRankSortWeight = (rank?: string | null) => {
    const normalized = String(rank || '').trim().toLowerCase();
    const rankIndex = RANK_INDEX_BY_KEY.get(normalized);
    return rankIndex === undefined ? Number.MAX_SAFE_INTEGER : rankIndex;
  };

  const collectAliases = (values: Array<string | null | undefined>) => values
    .map((value) => normalizeName(value))
    .filter(Boolean);

  const loadPersonnel = async () => {
    setLoading(true);

    try {
      const { profile } = await getAuthenticatedState();
      setIsStaff(profile?.role === 'admin' || profile?.role === 'officer');

      const excludedNames = await fetchExcludedPersonnelNames();

      const { data: rosterData, error: rosterError } = await supabase
        .from('roster')
        .select('id, profile_id, rank, callsign, company, profile:profiles!roster_profile_id_fkey(roblox_username, roblox_id, discord_username, callsign, rank, company)')
        .order('created_at', { ascending: true });

      if (rosterError) {
        throw rosterError;
      }

      const [{ data: profileData }, { data: battleLogData }, personnelResponse] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, rank, company, roblox_username, roblox_id, discord_username, callsign'),
        supabase
          .from('battle_stat_logs')
          .select('participant_name, unit, created_at')
          .order('created_at', { ascending: false }),
        supabase
          .from('personnel')
          .select('roblox_username, rank, unit')
      ]);

      const personnelError = personnelResponse.error;
      if (personnelError && !/does not exist|relation/i.test(personnelError.message)) {
        throw personnelError;
      }

      const personnelDirectory = ((personnelResponse.data || []) as PersonnelDirectoryRecord[])
        .filter((entry) => !excludedNames.has(normalizeName(entry.roblox_username)));

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

      const profileAliases = new Map<string, ProfileRecord>();
      ((profileData || []) as ProfileRecord[]).forEach((profile) => {
        collectAliases([profile.roblox_username, profile.discord_username, profile.callsign]).forEach((alias) => {
          profileAliases.set(alias, profile);
        });
      });

      const rosterRecords = (rosterData || []) as RosterRecord[];
      const personnelByAlias = new Map<string, PersonnelDirectoryRecord>();
      personnelDirectory.forEach((entry) => {
        const normalized = normalizeName(entry.roblox_username);
        if (normalized) {
          personnelByAlias.set(normalized, entry);
        }
      });

      const battleParticipants = new Map<string, BattleLogParticipant>();
      ((battleLogData || []) as BattleLogParticipant[]).forEach((entry) => {
        const participantName = String(entry.participant_name || '').trim();
        const normalized = normalizeName(participantName);
        if (!participantName || excludedNames.has(normalized) || battleParticipants.has(normalized)) {
          return;
        }

        battleParticipants.set(normalized, {
          participant_name: participantName,
          unit: entry.unit || 'Unassigned'
        });
      });

      const rosterRowsResolved = await Promise.all(
        rosterRecords.map(async (entry) => {
          const robloxName = entry.profile?.roblox_username || entry.callsign || entry.profile?.discord_username || 'Unknown';
          if (excludedNames.has(normalizeName(robloxName)) || excludedNames.has(normalizeName(entry.profile?.callsign)) || excludedNames.has(normalizeName(entry.callsign))) {
            return null;
          }
          if (!isRosterEligibleRank(entry.rank)) {
            return null;
          }
          const groupRank = sanitizeGroupRank(entry.rank);

          return {
            key: `profile:${entry.profile_id}`,
            priority: 2,
            profileId: entry.profile_id,
            username: String(robloxName),
            combinedName: `${groupRank} - ${robloxName}`,
            unit: entry.company || 'Unassigned',
            groupRank,
            medals: medalsByProfile.get(entry.profile_id) || []
          } as PersonnelSourceRow;
        })
      );

      const battleRowsResolved = await Promise.all(
        Array.from(battleParticipants.values()).map(async (entry) => {
          const normalized = normalizeName(entry.participant_name);
          const matchedProfile = profileAliases.get(normalized) || null;
          const directoryMatch = personnelByAlias.get(normalized) || null;
          const sourceRank = matchedProfile?.rank || directoryMatch?.rank || 'Unranked';
          if (!isRosterEligibleRank(sourceRank)) {
            return null;
          }
          const groupRank = sanitizeGroupRank(sourceRank);

          return {
            key: matchedProfile ? `profile:${matchedProfile.id}` : `battle:${normalized}`,
            priority: matchedProfile ? 1 : 0,
            profileId: matchedProfile?.id || null,
            username: String(entry.participant_name),
            combinedName: `${groupRank} - ${entry.participant_name}`,
            unit: matchedProfile?.company || directoryMatch?.unit || entry.unit || 'Unassigned',
            groupRank,
            medals: matchedProfile ? (medalsByProfile.get(matchedProfile.id) || []) : []
          } as PersonnelSourceRow;
        })
      );

      const mergedRows = new Map<string, PersonnelSourceRow>();

      [...battleRowsResolved, ...rosterRowsResolved].forEach((row) => {
        if (!row) {
          return;
        }
        const existing = mergedRows.get(row.key);
        if (!existing || row.priority > existing.priority) {
          mergedRows.set(row.key, row);
        }
      });

      setRows(
        Array.from(mergedRows.values())
          .map((row) => row)
          .sort((left, right) => {
            const rankDelta = getRankSortWeight(right.groupRank) - getRankSortWeight(left.groupRank);
            if (rankDelta !== 0) {
              return rankDelta;
            }

            return left.combinedName.localeCompare(right.combinedName);
          })
      );
      setRosterRows(rosterRecords);
      setPersonnelDirectoryRows(personnelDirectory);
    } catch (error) {
      console.error('Personnel roster load failed', error);
      setRows([]);
      setRosterRows([]);
      setPersonnelDirectoryRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPersonnel();
  }, []);

  const visibleRows = useMemo(
    () => rows.filter((row) => [row.combinedName, row.username, row.unit, row.groupRank, row.medals.join(' ')].join(' ').toLowerCase().includes(query.toLowerCase())),
    [query, rows]
  );

  const unitOptions = [
    { value: 'Unassigned', label: 'Unassigned' },
    { value: 'Battery Command', label: 'Battery Command' },
    { value: '82nd Pirkland', label: '82nd Pirkland' },
    { value: '87th Melrose', label: '87th Melrose' }
  ];

  const updateVisibleRowUnit = async (row: PersonnelRow, nextUnit: string) => {
    const normalizedUnit = String(nextUnit || '').trim() || 'Unassigned';
    setActiveUnitKey(row.key);

    try {
      if (row.profileId) {
        await supabase.from('profiles').update({ company: normalizedUnit }).eq('id', row.profileId);
        await supabase.from('roster').update({ company: normalizedUnit }).eq('profile_id', row.profileId);
      }

      if (row.username) {
        await supabase
          .from('personnel')
          .upsert({
            roblox_username: row.username,
            unit: normalizedUnit,
            rank: row.groupRank || 'Unranked',
            updated_at: new Date().toISOString()
          }, { onConflict: 'roblox_username' });
      }

      const rosterMatch = row.profileId
        ? rosterRows.find((entry) => entry.profile_id === row.profileId)
        : null;
      await syncBattleLogUnitsForAliases([
        row.username,
        rosterMatch?.callsign,
        rosterMatch?.profile?.roblox_username,
        rosterMatch?.profile?.discord_username,
        rosterMatch?.profile?.callsign
      ], normalizedUnit);

      await loadPersonnel();
    } catch (updateError) {
      console.error('Inline unit update failed', updateError);
    } finally {
      setActiveUnitKey(null);
    }
  };

  const syncRanksFromRobloxGroup = async () => {
    setSyncingRanks(true);
    setSyncError(null);
    setSyncSummary(null);

    try {
      const rowsWithUsernames = rosterRows
        .map((entry) => ({
          entry,
          username: String(entry.profile?.roblox_username || entry.callsign || '').trim()
        }))
        .filter((item) => item.username.length > 0);

      const personnelDirectoryUsernames = personnelDirectoryRows
        .map((entry) => String(entry.roblox_username || '').trim())
        .filter((value) => Boolean(value));

      const personnelUsernames = rows
        .map((row) => {
          const separator = ' - ';
          const separatorIndex = row.combinedName.indexOf(separator);
          if (separatorIndex === -1) {
            return '';
          }
          return row.combinedName.slice(separatorIndex + separator.length).trim();
        })
        .filter((value) => Boolean(value));

      const candidateUsernames = [
        ...rowsWithUsernames.map((item) => item.username),
        ...personnelDirectoryUsernames,
        ...personnelUsernames
      ];
      const usernameByKey = new Map<string, string>();
      candidateUsernames.forEach((username) => {
        const trimmed = String(username || '').trim();
        if (!trimmed) {
          return;
        }
        const key = trimmed.toLowerCase();
        if (!usernameByKey.has(key)) {
          usernameByKey.set(key, trimmed);
        }
      });
      const uniqueUsernames = Array.from(usernameByKey.values());

      if (uniqueUsernames.length === 0) {
        setSyncSummary({
          totalRosterRows: rosterRows.length,
          totalPersonnelRows: rows.length,
          totalPersonnelDirectoryRows: personnelDirectoryRows.length,
          rowsWithUsableUsername: 0,
          uniqueUsernamesChecked: 0,
          usernamesResolved: 0,
          usernamesUnresolved: [],
          roleLookupFailures: [],
          rosterRanksUpdated: 0,
          rosterRanksUnchanged: 0,
          personnelRanksUpdated: 0,
          personnelRanksUnchanged: 0,
          failedProfileUpdates: [],
          failedPersonnelUpdates: [],
          skippedMissingUsername: rosterRows.length
        });
        await loadPersonnel();
        return;
      }

      const syncResponse = await fetch('/api/roblox/sync-ranks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId: GROUP_ID,
          usernames: uniqueUsernames
        })
      });

      const syncPayload = await syncResponse.json().catch(() => ({} as BulkSyncResponse));
      if (!syncResponse.ok) {
        throw new Error(syncPayload?.message || 'Unable to sync Roblox ranks right now.');
      }

      const rankByUsername = new Map<string, string>(
        Object.entries((syncPayload as BulkSyncResponse).rankByUsername || {})
          .map(([username, rank]) => [String(username).toLowerCase(), String(rank)])
      );

      let rosterRanksUpdated = 0;
      let rosterRanksUnchanged = 0;
      let personnelRanksUpdated = 0;
      let personnelRanksUnchanged = 0;
      const failedProfileUpdates: string[] = [];
      const failedPersonnelUpdates: string[] = [];

      const personnelDirectoryByKey = new Map<string, PersonnelDirectoryRecord>();
      personnelDirectoryRows.forEach((entry) => {
        const key = normalizeName(entry.roblox_username);
        if (key) {
          personnelDirectoryByKey.set(key, entry);
        }
      });

      const nowIso = new Date().toISOString();

      for (const { entry, username } of rowsWithUsernames) {
        const usernameKey = username.toLowerCase();
        const rawResolvedRank = rankByUsername.get(usernameKey);
        if (!rawResolvedRank) {
          continue;
        }

        const resolvedRank = normalizeSyncedRank(rawResolvedRank);
        if (!resolvedRank) {
          continue;
        }

        if (shouldSkipUnrankedOverwrite(entry.rank, resolvedRank)) {
          rosterRanksUnchanged += 1;
          continue;
        }

        if (resolvedRank === entry.rank) {
          rosterRanksUnchanged += 1;
          continue;
        }

        const { error } = await supabase
          .from('roster')
          .update({ rank: resolvedRank })
          .eq('profile_id', entry.profile_id);

        if (error) {
          failedProfileUpdates.push(username);
          continue;
        }

        rosterRanksUpdated += 1;
      }

      for (const username of uniqueUsernames) {
        const usernameKey = username.toLowerCase();
        const rawResolvedRank = rankByUsername.get(usernameKey);
        if (!rawResolvedRank) {
          continue;
        }

        const resolvedRank = normalizeSyncedRank(rawResolvedRank);
        if (!resolvedRank) {
          continue;
        }

        const existingDirectory = personnelDirectoryByKey.get(usernameKey) || null;
        if (shouldSkipUnrankedOverwrite(existingDirectory?.rank, resolvedRank)) {
          personnelRanksUnchanged += 1;
          continue;
        }

        if (existingDirectory?.rank === resolvedRank) {
          personnelRanksUnchanged += 1;
          continue;
        }

        const { error } = await supabase
          .from('personnel')
          .upsert({
            roblox_username: existingDirectory?.roblox_username || username,
            rank: resolvedRank,
            unit: existingDirectory?.unit || 'Unassigned',
            last_rank_sync_at: nowIso,
            updated_at: nowIso
          }, { onConflict: 'roblox_username' });

        if (error) {
          failedPersonnelUpdates.push(username);
          continue;
        }

        personnelRanksUpdated += 1;
      }

      setSyncSummary({
        totalRosterRows: rosterRows.length,
        totalPersonnelRows: rows.length,
        totalPersonnelDirectoryRows: personnelDirectoryRows.length,
        rowsWithUsableUsername: rowsWithUsernames.length,
        uniqueUsernamesChecked: uniqueUsernames.length,
        usernamesResolved: syncPayload?.usernamesResolved || 0,
        usernamesUnresolved: Array.isArray(syncPayload?.unresolvedUsernames) ? syncPayload.unresolvedUsernames : [],
        roleLookupFailures: Array.isArray(syncPayload?.roleLookupFailures) ? syncPayload.roleLookupFailures : [],
        rosterRanksUpdated,
        rosterRanksUnchanged,
        personnelRanksUpdated,
        personnelRanksUnchanged,
        failedProfileUpdates,
        failedPersonnelUpdates,
        skippedMissingUsername: rosterRows.length - rowsWithUsernames.length
      });

      await loadPersonnel();
    } catch (syncError) {
      console.error('Rank sync failed', syncError);
      setSyncError(syncError instanceof Error ? syncError.message : 'Unable to sync ranks right now.');
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
          <div className="flex flex-col gap-3 sm:min-w-[20rem] sm:flex-row sm:items-center">
            <input value={query} onChange={(e) => setQuery(e.target.value)} className="rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver" placeholder="Search by username or rank" />
            {isStaff && (
              <button
                type="button"
                onClick={() => void syncRanksFromRobloxGroup()}
                disabled={syncingRanks}
                className="rounded border border-slateBlue/70 px-3 py-2 text-xs uppercase tracking-[0.3em] text-slate-300 disabled:opacity-60"
              >
                {syncingRanks ? 'Syncing Group Ranks...' : 'Sync Ranks from Roblox Group'}
              </button>
            )}
          </div>
        </div>
        {syncError && <p className="mt-4 text-sm text-red-400">{syncError}</p>}
        {syncSummary && (
          <div className="mt-4 rounded border border-slateBlue/60 bg-[#0d121b] p-3 text-sm text-slate-300">
            Synced {syncSummary.rosterRanksUpdated} roster ranks and {syncSummary.personnelRanksUpdated} personnel ranks. Resolved usernames: {syncSummary.usernamesResolved} of {syncSummary.uniqueUsernamesChecked}.
          </div>
        )}
      </div>

      <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
        <div className="mb-4 text-[10px] uppercase tracking-[0.35em] text-slate-400">Command</div>
        {loading ? <p className="text-sm text-slate-400">Loading accepted personnel...</p> : (
          <PersonnelTable
            rows={visibleRows}
            editableUnits={isStaff}
            unitOptions={unitOptions}
            updatingUnitKey={activeUnitKey}
            onUnitChange={(row, unit) => void updateVisibleRowUnit(row as PersonnelRow, unit)}
          />
        )}
      </div>

      {isStaff && <PersonnelManagementPanel onChanged={() => loadPersonnel()} />}
    </section>
  );
}
