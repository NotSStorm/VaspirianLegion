import { useEffect, useMemo, useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';
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
  requested_company?: string | null;
  requested_group_rank?: string | null;
  requested_group_join: boolean;
  status: 'pending' | 'approved' | 'rejected' | string;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
};

type MedalRequestRecord = {
  id: string;
  requester_profile_id: string;
  medal_name: string;
  request_note?: string | null;
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

type AdminSection = 'new-applicants' | 'applicant-history' | 'admin-permissions' | 'medal-requests';

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

type RosterEnsureResult = {
  created: boolean;
  callsign: string;
};

const sections: Array<{ key: AdminSection; label: string }> = [
  { key: 'new-applicants', label: 'New Applicants' },
  { key: 'applicant-history', label: 'Applicant History' },
  { key: 'admin-permissions', label: 'Admin Permissions' },
  { key: 'medal-requests', label: 'Medal Requests' }
];

function isValidSection(value: string | undefined): value is AdminSection {
  return value === 'new-applicants' || value === 'applicant-history' || value === 'admin-permissions' || value === 'medal-requests';
}

export default function AdminPage() {
  const params = useParams<{ section?: string }>();
  const activeSection: AdminSection = isValidSection(params.section) ? params.section : 'new-applicants';

  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [medalRequests, setMedalRequests] = useState<MedalRequestRecord[]>([]);
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

  const loadAdminData = async () => {
    setLoading(true);
    setError(null);

    try {
      const { profile } = await getAuthenticatedState();
      setViewerProfileId(profile?.id || null);

      const [
        { data: applicationData, error: applicationError },
        { data: profileData, error: profileError },
        { data: rosterData, error: rosterError },
        personnelResponse,
        { data: battleData, error: battleError },
        medalRequestsResponse
      ] = await Promise.all([
        supabase
          .from('applications')
          .select('id, profile_id, service_number, callsign, timezone, requested_company, requested_group_rank, requested_group_join, status, reviewed_by, reviewed_at, created_at')
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
          .order('created_at', { ascending: true }),
        supabase
          .from('medal_requests')
          .select('id, requester_profile_id, medal_name, request_note, status, reviewed_by, reviewed_at, created_at')
          .order('created_at', { ascending: false })
      ]);

      if (applicationError) throw applicationError;
      if (profileError) throw profileError;
      if (rosterError) throw rosterError;
      if (battleError) throw battleError;
      if (personnelResponse.error && !/does not exist|relation/i.test(personnelResponse.error.message)) {
        throw personnelResponse.error;
      }
      if (medalRequestsResponse.error && !/does not exist|relation/i.test(medalRequestsResponse.error.message)) {
        throw medalRequestsResponse.error;
      }

      setApplications((applicationData || []) as ApplicationRecord[]);
      setProfiles((profileData || []) as ProfileRecord[]);
      setRosterRows((rosterData || []) as RosterRecord[]);
      setPersonnelRows((personnelResponse.data || []) as PersonnelDirectoryRecord[]);
      setBattleNames((battleData || []) as BattleNameRecord[]);
      setMedalRequests((medalRequestsResponse.data || []) as MedalRequestRecord[]);
    } catch (loadError) {
      console.error('Unable to load admin data', loadError);
      setError(loadError instanceof Error ? loadError.message : 'Unable to load admin data.');
      setApplications([]);
      setProfiles([]);
      setRosterRows([]);
      setPersonnelRows([]);
      setBattleNames([]);
      setMedalRequests([]);
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

  const pendingMedalRequests = useMemo(
    () => medalRequests.filter((entry) => entry.status === 'pending'),
    [medalRequests]
  );

  const reviewedMedalRequests = useMemo(
    () => medalRequests.filter((entry) => entry.status !== 'pending'),
    [medalRequests]
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

  const ensureRosterEntryForApprovedApplication = async (application: ApplicationRecord): Promise<RosterEnsureResult> => {
    const requestedCompany = String(application.requested_company || '').trim() || null;
    const requestedGroupRank = String(application.requested_group_rank || '').trim() || null;
    const { data: existingRoster, error: rosterLookupError } = await supabase
      .from('roster')
      .select('profile_id, callsign, group_rank')
      .eq('profile_id', application.profile_id)
      .maybeSingle();

    if (rosterLookupError) {
      throw rosterLookupError;
    }

    if (existingRoster) {
      const rosterUpdatePayload: Record<string, string> = {};
      if (requestedCompany) {
        rosterUpdatePayload.company = requestedCompany;
        await supabase.from('profiles').update({ company: requestedCompany }).eq('id', application.profile_id);
      }

      if (requestedGroupRank) {
        rosterUpdatePayload.group_rank = requestedGroupRank;
      }

      if (Object.keys(rosterUpdatePayload).length > 0) {
        await supabase.from('roster').update(rosterUpdatePayload).eq('profile_id', application.profile_id);
      }

      if (requestedGroupRank) {
        await supabase.from('personnel').upsert({
          roblox_username: String(existingRoster.callsign || application.callsign || '').trim(),
          rank: requestedGroupRank,
          unit: requestedCompany || 'Unassigned',
          last_rank_sync_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, { onConflict: 'roblox_username' });
      }

      return {
        created: false,
        callsign: String(existingRoster.callsign || application.callsign || '').trim()
      };
    }

    let applicantProfile = profileById.get(application.profile_id) || null;
    if (!applicantProfile) {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, role, roblox_username, discord_username, callsign')
        .eq('id', application.profile_id)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      applicantProfile = (profileData as ProfileRecord | null) || null;
    }

    const resolvedCallsign = String(
      applicantProfile?.roblox_username || applicantProfile?.callsign || application.callsign || ''
    ).trim();

    if (!resolvedCallsign) {
      throw new Error('Unable to create roster row: applicant callsign/username is missing.');
    }

    const { error: insertError } = await supabase.from('roster').insert({
      profile_id: application.profile_id,
      rank: 'CST',
      group_rank: requestedGroupRank,
      company: requestedCompany,
      callsign: resolvedCallsign
    });

    if (insertError) {
      if (/duplicate key value|unique constraint|23505/i.test(insertError.message)) {
        return {
          created: false,
          callsign: resolvedCallsign
        };
      }

      throw insertError;
    }

    if (requestedCompany) {
      await supabase.from('profiles').update({ company: requestedCompany }).eq('id', application.profile_id);
    }

    if (requestedGroupRank) {
      await supabase.from('personnel').upsert({
        roblox_username: resolvedCallsign,
        rank: requestedGroupRank,
        unit: requestedCompany || 'Unassigned',
        last_rank_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'roblox_username' });
    }

    return {
      created: true,
      callsign: resolvedCallsign
    };
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

      if (status === 'approved') {
        await ensureRosterEntryForApprovedApplication(application);
      }

      await refreshWithMessage(`${status === 'approved' ? 'Approved' : 'Rejected'} application for ${application.callsign}.`);
    } catch (updateError) {
      console.error('Unable to review application', updateError);
      setError(updateError instanceof Error ? updateError.message : 'Unable to review application.');
    } finally {
      setBusyKey(null);
    }
  };

  const reprocessAcceptedApplication = async (application: ApplicationRecord) => {
    setBusyKey(`reprocess:${application.id}`);
    setError(null);
    setSuccess(null);

    try {
      const result = await ensureRosterEntryForApprovedApplication(application);
      const displayCallsign = result.callsign || application.callsign || toDisplayName(profileById.get(application.profile_id) || null);
      await refreshWithMessage(
        result.created
          ? `Roster entry created for ${displayCallsign}.`
          : `${displayCallsign} already has a roster entry.`
      );
    } catch (reprocessError) {
      console.error('Unable to re-process accepted application', reprocessError);
      setError(reprocessError instanceof Error ? reprocessError.message : 'Unable to re-process accepted application.');
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

  const reviewMedalRequest = async (request: MedalRequestRecord, status: 'approved' | 'rejected') => {
    setBusyKey(`medal-request:${request.id}:${status}`);
    setError(null);
    setSuccess(null);

    try {
      const { error: updateError } = await supabase
        .from('medal_requests')
        .update({
          status,
          reviewed_by: viewerProfileId,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', request.id);

      if (updateError) {
        throw updateError;
      }

      await refreshWithMessage(`${status === 'approved' ? 'Approved' : 'Rejected'} medal request for ${request.medal_name}.`);
    } catch (updateError) {
      console.error('Unable to review medal request', updateError);
      setError(updateError instanceof Error ? updateError.message : 'Unable to review medal request.');
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <section className="space-y-6">
      <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
        <div className="text-[10px] uppercase tracking-[0.35em] text-slate-400">Admin Panel</div>
        <h2 className="mt-2 text-3xl font-semibold uppercase tracking-[0.2em] text-silver">Admin Categories</h2>
        <p className="mt-3 text-sm text-slate-300">Use categories to manage applicants, permissions, and medal requests.</p>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        {success && <p className="mt-3 text-sm text-emerald-300">{success}</p>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {sections.map((section) => {
          const notificationCount = section.key === 'new-applicants'
            ? pendingApplications.length
            : section.key === 'medal-requests'
              ? pendingMedalRequests.length
              : 0;

          return (
            <NavLink
              key={section.key}
              to={`/admin/${section.key}`}
              className={({ isActive }) => `rounded border p-4 text-sm uppercase tracking-[0.2em] ${isActive ? 'border-silver/50 bg-[#1a2230] text-silver' : 'border-slateBlue/70 bg-[#141a24] text-slate-300 hover:border-silver/30'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span>{section.label}</span>
                {notificationCount > 0 && (
                  <span className="rounded border border-amber-500/50 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-300">
                    {notificationCount}
                  </span>
                )}
              </div>
            </NavLink>
          );
        })}
      </div>

      {activeSection === 'new-applicants' && (
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
                      {application.requested_company && (
                        <div className="mt-1 text-xs text-slate-300">Requested Company: {application.requested_company}</div>
                      )}
                      {application.requested_group_rank && (
                        <div className="mt-1 text-xs text-slate-300">Incoming Roblox Rank: {application.requested_group_rank}</div>
                      )}
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
      )}

      {activeSection === 'applicant-history' && (
        <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
          <div className="mb-4 text-[10px] uppercase tracking-[0.35em] text-slate-400">Applicant History</div>

          <div className="mb-6">
            <div className="mb-3 text-xs uppercase tracking-[0.3em] text-slate-400">Past Acceptances</div>
            {!loading && acceptedApplications.length === 0 && <p className="text-sm text-slate-400">No approved applications yet.</p>}
            <div className="space-y-3">
              {acceptedApplications.map((application) => {
                const reprocessBusy = busyKey === `reprocess:${application.id}`;
                const applicant = profileById.get(application.profile_id) || null;
                const reviewer = application.reviewed_by ? (profileById.get(application.reviewed_by) || null) : null;
                const hasRosterEntry = rosterRows.some((row) => row.profile_id === application.profile_id);
                return (
                  <div key={application.id} className="rounded border border-slateBlue/60 bg-[#0d121b] p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="text-sm font-semibold text-silver">{application.callsign || toDisplayName(applicant)}</div>
                        <div className="mt-1 text-xs text-slate-400">Applicant: {toDisplayName(applicant)} • Timezone: {application.timezone || 'N/A'}</div>
                        {application.requested_company && (
                          <div className="mt-1 text-xs text-slate-300">Requested Company: {application.requested_company}</div>
                        )}
                        {application.requested_group_rank && (
                          <div className="mt-1 text-xs text-slate-300">Incoming Roblox Rank: {application.requested_group_rank}</div>
                        )}
                        <div className="mt-1 text-xs text-slate-500">Approved {formatDateTime(application.reviewed_at)} by {toDisplayName(reviewer)}</div>
                        <div className={`mt-1 text-xs ${hasRosterEntry ? 'text-emerald-300' : 'text-amber-300'}`}>
                          {hasRosterEntry ? 'Roster entry exists' : 'Roster entry missing'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void reprocessAcceptedApplication(application)}
                        disabled={reprocessBusy}
                        className="rounded border border-emerald-500/50 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-300 disabled:opacity-60"
                      >
                        {reprocessBusy ? 'Re-Processing...' : 'Retry Roster Creation'}
                      </button>
                    </div>
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
                    {application.requested_company && (
                      <div className="mt-1 text-xs text-slate-300">Requested Company: {application.requested_company}</div>
                    )}
                    {application.requested_group_rank && (
                      <div className="mt-1 text-xs text-slate-300">Incoming Roblox Rank: {application.requested_group_rank}</div>
                    )}
                    <div className="mt-1 text-xs text-slate-500">Rejected {formatDateTime(application.reviewed_at)} by {toDisplayName(reviewer)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeSection === 'admin-permissions' && (
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
      )}

      {activeSection === 'medal-requests' && (
        <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
          <div className="mb-4 text-[10px] uppercase tracking-[0.35em] text-slate-400">Medal Requests</div>

          <div className="mb-6">
            <div className="mb-3 text-xs uppercase tracking-[0.3em] text-slate-400">Pending Requests</div>
            {!loading && pendingMedalRequests.length === 0 && <p className="text-sm text-slate-400">No pending medal requests.</p>}
            <div className="space-y-3">
              {pendingMedalRequests.map((request) => {
                const approveBusy = busyKey === `medal-request:${request.id}:approved`;
                const rejectBusy = busyKey === `medal-request:${request.id}:rejected`;
                const requester = profileById.get(request.requester_profile_id) || null;
                const isBusy = approveBusy || rejectBusy;

                return (
                  <div key={request.id} className="rounded border border-slateBlue/60 bg-[#0d121b] p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="text-sm font-semibold text-silver">{request.medal_name}</div>
                        <div className="mt-1 text-xs text-slate-400">Requester: {toDisplayName(requester)}</div>
                        <div className="mt-1 text-xs text-slate-500">Submitted {formatDateTime(request.created_at)}</div>
                        {request.request_note && (
                          <div className="mt-2 text-xs text-slate-300">{request.request_note}</div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void reviewMedalRequest(request, 'approved')}
                          disabled={isBusy}
                          className="rounded border border-emerald-500/50 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-300 disabled:opacity-60"
                        >
                          {approveBusy ? 'Approving...' : 'Approve'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void reviewMedalRequest(request, 'rejected')}
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

          <div>
            <div className="mb-3 text-xs uppercase tracking-[0.3em] text-slate-400">Reviewed Requests</div>
            {!loading && reviewedMedalRequests.length === 0 && <p className="text-sm text-slate-400">No reviewed medal requests yet.</p>}
            <div className="space-y-3">
              {reviewedMedalRequests.map((request) => {
                const requester = profileById.get(request.requester_profile_id) || null;
                const reviewer = request.reviewed_by ? (profileById.get(request.reviewed_by) || null) : null;

                return (
                  <div key={request.id} className="rounded border border-slateBlue/60 bg-[#0d121b] p-4">
                    <div className="text-sm font-semibold text-silver">{request.medal_name}</div>
                    <div className="mt-1 text-xs text-slate-400">Requester: {toDisplayName(requester)}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {request.status.toUpperCase()} {request.reviewed_at ? `on ${formatDateTime(request.reviewed_at)}` : ''} {reviewer ? `by ${toDisplayName(reviewer)}` : ''}
                    </div>
                    {request.request_note && (
                      <div className="mt-2 text-xs text-slate-300">{request.request_note}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
