import { useEffect, useMemo, useState } from 'react';
import { getAuthenticatedState } from '../lib/auth';
import { normalizePersonnelName } from '../lib/personnel';
import { supabase } from '../lib/supabase';
import type { Role } from '../types';

type ApplicationRecord = {
  id: string;
  profile_id: string;
  service_number?: string | null;
  callsign: string;
  timezone: string;
  requested_group_join: boolean;
  status: 'pending' | 'approved' | 'rejected' | string;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
};

type ProfileRecord = {
  id: string;
  role: Role;
  roblox_username?: string | null;
  discord_username?: string | null;
  callsign?: string | null;
};

type RosterRecord = {
  profile_id: string;
  callsign?: string | null;
  profile?: {
    roblox_username?: string | null;
    discord_username?: string | null;
    callsign?: string | null;
  } | null;
};

type PersonnelDirectoryRecord = {
  roblox_username: string;
};

type BattleNameRecord = {
  participant_name: string;
};

function toDisplayName(profile?: ProfileRecord | null) {
  if (!profile) {
    return 'Unknown User';
  }

  return String(profile.roblox_username || profile.callsign || profile.discord_username || profile.id);
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return 'N/A';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

function normalizeProfileAliases(profile: ProfileRecord, aliasesByProfileId: Map<string, string[]>) {
  const aliases = [
    profile.roblox_username,
    profile.callsign,
    profile.discord_username,
    ...(aliasesByProfileId.get(profile.id) || [])
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  return Array.from(new Set(aliases));
}

export default function AdminPage() {
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [profiles, setProfiles] = useState<ProfileRecord[]>([]);
  const [rosterRows, setRosterRows] = useState<RosterRecord[]>([]);
  const [personnelRows, setPersonnelRows] = useState<PersonnelDirectoryRecord[]>([]);
  const [battleNames, setBattleNames] = useState<BattleNameRecord[]>([]);
  const [viewerProfileId, setViewerProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [profileQuery, setProfileQuery] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);

  const loadAdminData = async () => {
    setLoading(true);
    setError(null);

    try {
      const { profile } = await getAuthenticatedState();
      setViewerProfileId(profile?.id || null);

      const [{ data: applicationData, error: applicationError }, { data: profileData, error: profileError }, { data: rosterData, error: rosterError }, personnelResponse, { data: battleData, error: battleError }] = await Promise.all([
        supabase
          .from('applications')
          .select('id, profile_id, service_number, callsign, timezone, requested_group_join, status, reviewed_by, reviewed_at, created_at')
          .order('created_at', { ascending: false }),
        supabase
          .from('profiles')
          .select('id, role, roblox_username, discord_username, callsign')
          .order('created_at', { ascending: true }),
        supabase
          .from('roster')
          .select('profile_id, callsign, profile:profiles!roster_profile_id_fkey(roblox_username, discord_username, callsign)')
          .order('created_at', { ascending: true }),
        supabase
          .from('personnel')
          .select('roblox_username'),
        supabase
          .from('battle_stat_logs')
          .select('participant_name')
          .order('created_at', { ascending: true })
      ]);

      if (applicationError) throw applicationError;
      if (profileError) throw profileError;
      if (rosterError) throw rosterError;
      if (battleError) throw battleError;
      if (personnelResponse.error && !/does not exist|relation/i.test(personnelResponse.error.message)) {
        throw personnelResponse.error;
      }

      setApplications((applicationData || []) as ApplicationRecord[]);
      setProfiles((profileData || []) as ProfileRecord[]);
      setRosterRows((rosterData || []) as RosterRecord[]);
      setPersonnelRows((personnelResponse.data || []) as PersonnelDirectoryRecord[]);
      setBattleNames((battleData || []) as BattleNameRecord[]);
    } catch (loadError) {
      console.error('Unable to load admin data', loadError);
      setError(loadError instanceof Error ? loadError.message : 'Unable to load admin data.');
      setApplications([]);
      setProfiles([]);
      setRosterRows([]);
      setPersonnelRows([]);
      setBattleNames([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAdminData();
  }, []);

  const profileById = useMemo(() => {
    const map = new Map<string, ProfileRecord>();
    profiles.forEach((entry) => map.set(entry.id, entry));
    return map;
  }, [profiles]);

  const pendingApplications = useMemo(
    () => applications.filter((entry) => entry.status === 'pending'),
    [applications]
  );

  const acceptedApplications = useMemo(
    () => applications.filter((entry) => entry.status === 'approved'),
    [applications]
  );

  const rejectedApplications = useMemo(
    () => applications.filter((entry) => entry.status === 'rejected'),
    [applications]
  );

  const aliasesByProfileId = useMemo(() => {
    const map = new Map<string, string[]>();

    rosterRows.forEach((row) => {
      const profileId = String(row.profile_id || '').trim();
      if (!profileId) {
        return;
      }

      const aliases = [row.callsign, row.profile?.roblox_username, row.profile?.discord_username, row.profile?.callsign]
        .map((value) => String(value || '').trim())
        .filter(Boolean);

      if (aliases.length === 0) {
        return;
      }

      const existing = map.get(profileId) || [];
      map.set(profileId, Array.from(new Set([...existing, ...aliases])));
    });

    return map;
  }, [rosterRows]);

  const filteredProfiles = useMemo(() => {
    const query = profileQuery.trim().toLowerCase();
    const candidates = profiles;
    if (!query) {
      return candidates;
    }

    return candidates.filter((entry) => {
      const aliases = normalizeProfileAliases(entry, aliasesByProfileId);
      return [...aliases, entry.role, entry.id].join(' ').toLowerCase().includes(query);
    });
  }, [aliasesByProfileId, profileQuery, profiles]);

  const unlinkedMatches = useMemo(() => {
    const query = profileQuery.trim().toLowerCase();
    if (!query) {
      return [] as string[];
    }

    const linkedAliasSet = new Set<string>();
    profiles.forEach((profile) => {
      normalizeProfileAliases(profile, aliasesByProfileId).forEach((alias) => {
        const normalized = normalizePersonnelName(alias);
        if (normalized) {
          linkedAliasSet.add(normalized);
        }
      });
    });

    const candidateNames = new Set<string>();
    personnelRows.forEach((entry) => candidateNames.add(String(entry.roblox_username || '').trim()));
    battleNames.forEach((entry) => candidateNames.add(String(entry.participant_name || '').trim()));

    return Array.from(candidateNames)
      .filter(Boolean)
      .filter((name) => name.toLowerCase().includes(query))
      .filter((name) => !linkedAliasSet.has(normalizePersonnelName(name)));
  }, [aliasesByProfileId, battleNames, personnelRows, profileQuery, profiles]);

  const refreshWithMessage = async (message: string) => {
    setSuccess(message);
    await loadAdminData();
  };

  const reviewApplication = async (application: ApplicationRecord, status: 'approved' | 'rejected') => {
    setBusyKey(`review:${application.id}:${status}`);
    setError(null);
    setSuccess(null);

    try {
      const { error: updateError } = await supabase
        .from('applications')
        .update({
          status,
          reviewed_by: viewerProfileId,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', application.id);

      if (updateError) {
        throw updateError;
      }

      await refreshWithMessage(`${status === 'approved' ? 'Approved' : 'Rejected'} application for ${application.callsign}.`);
    } catch (updateError) {
      console.error('Unable to review application', updateError);
      setError(updateError instanceof Error ? updateError.message : 'Unable to review application.');
    } finally {
      setBusyKey(null);
    }
  };

  const updateAdminRole = async (profile: ProfileRecord, makeAdmin: boolean) => {
    setBusyKey(`admin:${profile.id}:${makeAdmin ? 'grant' : 'revoke'}`);
    setError(null);
    setSuccess(null);

    try {
      const nextRole: Role = makeAdmin ? 'admin' : 'member';
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ role: nextRole })
        .eq('id', profile.id);

      if (updateError) {
        throw updateError;
      }

      await refreshWithMessage(`${makeAdmin ? 'Granted' : 'Revoked'} admin role for ${toDisplayName(profile)}.`);
    } catch (updateError) {
      console.error('Unable to update admin role', updateError);
      setError(updateError instanceof Error ? updateError.message : 'Unable to update admin role.');
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <section className="space-y-6">
      <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
        <div className="text-[10px] uppercase tracking-[0.35em] text-slate-400">Admin Panel</div>
        <h2 className="mt-2 text-3xl font-semibold uppercase tracking-[0.2em] text-silver">Applicant Review + Admin Assignment</h2>
        <p className="mt-3 text-sm text-slate-300">Review new applicants and assign admin permissions.</p>
        <button
          type="button"
          onClick={() => setHistoryOpen((current) => !current)}
          className="mt-4 rounded border border-slateBlue/70 px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-300"
        >
          {historyOpen ? 'Hide Application History' : 'View Application History'}
        </button>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        {success && <p className="mt-3 text-sm text-emerald-300">{success}</p>}
      </div>

      <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
        <div className="mb-4 text-[10px] uppercase tracking-[0.35em] text-slate-400">New Applicants</div>
        {loading && <p className="text-sm text-slate-400">Loading applications...</p>}
        {!loading && pendingApplications.length === 0 && <p className="text-sm text-slate-400">No pending applications.</p>}
        <div className="space-y-3">
          {pendingApplications.map((application) => {
            const approveBusy = busyKey === `review:${application.id}:approved`;
            const rejectBusy = busyKey === `review:${application.id}:rejected`;
            const isBusy = approveBusy || rejectBusy;
            const applicant = profileById.get(application.profile_id) || null;

            return (
              <div key={application.id} className="rounded border border-slateBlue/60 bg-[#0d121b] p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-silver">{application.callsign || toDisplayName(applicant)}</div>
                    <div className="text-xs text-slate-400">Applicant: {toDisplayName(applicant)} • Timezone: {application.timezone || 'N/A'}</div>
                    <div className="mt-1 text-xs text-slate-500">Submitted {formatDateTime(application.created_at)}{application.service_number ? ` • ${application.service_number}` : ''}</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void reviewApplication(application, 'approved')}
                      disabled={isBusy}
                      className="rounded border border-emerald-500/50 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-300 disabled:opacity-60"
                    >
                      {approveBusy ? 'Approving...' : 'Approve'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void reviewApplication(application, 'rejected')}
                      disabled={isBusy}
                      className="rounded border border-red-500/50 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-red-300 disabled:opacity-60"
                    >
                      {rejectBusy ? 'Rejecting...' : 'Reject'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {historyOpen && (
        <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
          <div className="mb-4 text-[10px] uppercase tracking-[0.35em] text-slate-400">Application History</div>

          <div className="mb-6">
            <div className="mb-3 text-xs uppercase tracking-[0.3em] text-slate-400">Past Acceptances</div>
            {!loading && acceptedApplications.length === 0 && <p className="text-sm text-slate-400">No approved applications yet.</p>}
            <div className="space-y-3">
              {acceptedApplications.map((application) => {
                const applicant = profileById.get(application.profile_id) || null;
                const reviewer = application.reviewed_by ? (profileById.get(application.reviewed_by) || null) : null;
                return (
                  <div key={application.id} className="rounded border border-slateBlue/60 bg-[#0d121b] p-4">
                    <div className="text-sm font-semibold text-silver">{application.callsign || toDisplayName(applicant)}</div>
                    <div className="mt-1 text-xs text-slate-400">Applicant: {toDisplayName(applicant)} • Timezone: {application.timezone || 'N/A'}</div>
                    <div className="mt-1 text-xs text-slate-500">Approved {formatDateTime(application.reviewed_at)} by {toDisplayName(reviewer)}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <div className="mb-3 text-xs uppercase tracking-[0.3em] text-slate-400">Past Rejections</div>
            {!loading && rejectedApplications.length === 0 && <p className="text-sm text-slate-400">No rejected applications.</p>}
            <div className="space-y-3">
              {rejectedApplications.map((application) => {
                const applicant = profileById.get(application.profile_id) || null;
                const reviewer = application.reviewed_by ? (profileById.get(application.reviewed_by) || null) : null;
                return (
                  <div key={application.id} className="rounded border border-slateBlue/60 bg-[#0d121b] p-4">
                    <div className="text-sm font-semibold text-silver">{application.callsign || toDisplayName(applicant)}</div>
                    <div className="mt-1 text-xs text-slate-400">Applicant: {toDisplayName(applicant)} • Timezone: {application.timezone || 'N/A'}</div>
                    <div className="mt-1 text-xs text-slate-500">Rejected {formatDateTime(application.reviewed_at)} by {toDisplayName(reviewer)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
        <div className="mb-2 text-[10px] uppercase tracking-[0.35em] text-slate-400">Assign Admin</div>
        <p className="text-sm text-slate-300">Grant or revoke admin access for existing profiles.</p>
        <input
          value={profileQuery}
          onChange={(event) => setProfileQuery(event.target.value)}
          className="mt-4 w-full rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver"
          placeholder="Search Roblox, Discord, callsign, role, or profile id"
        />

        <div className="mt-4 space-y-3">
          {filteredProfiles.length === 0 && <p className="text-sm text-slate-400">No profiles match your search.</p>}
          {filteredProfiles.map((profile) => {
            const grantBusy = busyKey === `admin:${profile.id}:grant`;
            const revokeBusy = busyKey === `admin:${profile.id}:revoke`;
            const isBusy = grantBusy || revokeBusy;
            const isAdmin = profile.role === 'admin';
            const aliases = normalizeProfileAliases(profile, aliasesByProfileId);
            const displayName = aliases[0] || toDisplayName(profile);

            return (
              <div key={profile.id} className="flex flex-col gap-3 rounded border border-slateBlue/60 bg-[#0d121b] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-silver">{displayName}</div>
                  <div className="text-xs text-slate-400">Role: {profile.role} • ID: {profile.id}</div>
                  {aliases.length > 1 && <div className="text-xs text-slate-500">Aliases: {aliases.slice(1).join(', ')}</div>}
                </div>
                <button
                  type="button"
                  onClick={() => void updateAdminRole(profile, !isAdmin)}
                  disabled={isBusy}
                  className={`rounded border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] disabled:opacity-60 ${isAdmin ? 'border-red-500/50 text-red-300' : 'border-emerald-500/50 text-emerald-300'}`}
                >
                  {isAdmin ? (revokeBusy ? 'Revoking...' : 'Revoke Admin') : (grantBusy ? 'Granting...' : 'Grant Admin')}
                </button>
              </div>
            );
          })}
          {unlinkedMatches.map((name) => (
            <div key={`unlinked:${name}`} className="flex flex-col gap-3 rounded border border-amber-500/30 bg-[#0d121b] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-silver">{name}</div>
                <div className="text-xs text-amber-300">No linked profile found for this name</div>
              </div>
              <button
                type="button"
                disabled
                className="rounded border border-amber-500/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-amber-300 opacity-70"
              >
                Cannot Assign Yet
              </button>
            </div>
          ))}
          {filteredProfiles.length === 0 && unlinkedMatches.length > 0 && (
            <p className="text-xs text-slate-500">Those names exist in logs/personnel, but admin role can only be assigned to linked accounts in profiles.</p>
          )}
        </div>
      </div>
    </section>
  );
}
