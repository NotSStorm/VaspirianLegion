import { useEffect, useMemo, useState } from 'react';
import PersonnelTable from '../components/shared/PersonnelTable';
import { getAuthenticatedState } from '../lib/auth';
import { supabase } from '../lib/supabase';

const GROUP_ID = '5531725';

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
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [syncingRanks, setSyncingRanks] = useState(false);
  const [syncSummary, setSyncSummary] = useState<SyncSummary | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [personnelDirectoryRows, setPersonnelDirectoryRows] = useState<PersonnelDirectoryRecord[]>([]);

  const normalizeName = (value?: string | null) => String(value || '').trim().replace(/[_\s]+/g, '').toLowerCase();

  const collectAliases = (values: Array<string | null | undefined>) => values
    .map((value) => normalizeName(value))
    .filter(Boolean);

  const loadPersonnel = async () => {
    setLoading(true);

    try {
      const { profile } = await getAuthenticatedState();
      setIsStaff(profile?.role === 'admin' || profile?.role === 'officer');

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

      const personnelDirectory = (personnelResponse.data || []) as PersonnelDirectoryRecord[];

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
        if (!participantName || battleParticipants.has(normalized)) {
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
          const groupRank = entry.rank || 'Unranked';

          return {
            key: `profile:${entry.profile_id}`,
            priority: 2,
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
          const groupRank = matchedProfile?.rank || directoryMatch?.rank || 'Unranked';

          return {
            key: matchedProfile ? `profile:${matchedProfile.id}` : `battle:${normalized}`,
            priority: matchedProfile ? 1 : 0,
            combinedName: `${groupRank} - ${entry.participant_name}`,
            unit: matchedProfile?.company || directoryMatch?.unit || entry.unit || 'Unassigned',
            groupRank,
            medals: matchedProfile ? (medalsByProfile.get(matchedProfile.id) || []) : []
          } as PersonnelSourceRow;
        })
      );

      const mergedRows = new Map<string, PersonnelSourceRow>();

      [...battleRowsResolved, ...rosterRowsResolved].forEach((row) => {
        const existing = mergedRows.get(row.key);
        if (!existing || row.priority > existing.priority) {
          mergedRows.set(row.key, row);
        }
      });

      setRows(Array.from(mergedRows.values()).map(({ key, priority, ...row }) => row));
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
        .filter(Boolean);

      const personnelUsernames = rows
        .map((row) => {
          const separator = ' - ';
          const separatorIndex = row.combinedName.indexOf(separator);
          if (separatorIndex === -1) {
            return '';
          }
          return row.combinedName.slice(separatorIndex + separator.length).trim();
        })
        .filter(Boolean);

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
        const resolvedRank = rankByUsername.get(usernameKey);
        if (!resolvedRank) {
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
        const resolvedRank = rankByUsername.get(usernameKey);
        if (!resolvedRank) {
          continue;
        }

        const existingDirectory = personnelDirectoryByKey.get(usernameKey) || null;
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
          {syncError && <p className="mb-4 text-sm text-red-400">{syncError}</p>}
          {syncSummary && (
            <div className="mb-4 rounded border border-slateBlue/60 bg-[#0d121b] p-3 text-sm text-slate-300">
              <p>
                Synced {syncSummary.rosterRanksUpdated} roster ranks and {syncSummary.personnelRanksUpdated} personnel ranks. Unchanged: roster {syncSummary.rosterRanksUnchanged}, personnel {syncSummary.personnelRanksUnchanged}. Resolved usernames: {syncSummary.usernamesResolved} of {syncSummary.uniqueUsernamesChecked}.
              </p>
              <p className="mt-1">
                Roster rows: {syncSummary.totalRosterRows}. Personnel rows: {syncSummary.totalPersonnelRows}. Personnel directory rows: {syncSummary.totalPersonnelDirectoryRows}. Missing usernames: {syncSummary.skippedMissingUsername}. Failed role lookups: {syncSummary.roleLookupFailures.length}. Failed updates: roster {syncSummary.failedProfileUpdates.length}, personnel {syncSummary.failedPersonnelUpdates.length}.
              </p>
              {syncSummary.usernamesUnresolved.length > 0 && (
                <p className="mt-1 text-amber-300">
                  Could not resolve usernames: {syncSummary.usernamesUnresolved.slice(0, 10).join(', ')}{syncSummary.usernamesUnresolved.length > 10 ? '...' : ''}
                </p>
              )}
            </div>
          )}
          <h3 className="text-lg font-semibold uppercase tracking-[0.3em] text-silver">Assign Unit and Rank</h3>
          <div className="mt-4 space-y-3">
            {rosterRows.map((entry) => {
              const displayName = entry.profile?.roblox_username || entry.callsign || entry.profile?.discord_username || entry.profile_id;
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
