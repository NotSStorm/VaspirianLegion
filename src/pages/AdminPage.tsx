import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

type ApplicationReviewRow = {
  id: string;
  profile_id: string;
  callsign: string;
  timezone: string;
  status: 'pending' | 'approved' | 'rejected' | string;
  created_at: string;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  profile?: {
    discord_username?: string | null;
    roblox_username?: string | null;
  } | null;
};

type ProfileRoleRow = {
  id: string;
  discord_username?: string | null;
  roblox_username?: string | null;
  role: 'member' | 'officer' | 'admin' | string;
  created_at: string;
};

function prettyDate(value?: string | null) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function AdminPage() {
  const [applications, setApplications] = useState<ApplicationReviewRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeRoleId, setActiveRoleId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [sessionRole, setSessionRole] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const pendingCount = useMemo(
    () => applications.filter((application) => application.status === 'pending').length,
    [applications]
  );

  const pendingApplications = useMemo(
    () => applications.filter((application) => application.status === 'pending'),
    [applications]
  );

  const reviewedApplications = useMemo(
    () => applications.filter((application) => application.status === 'approved' || application.status === 'rejected'),
    [applications]
  );

  const canManageRoles = sessionRole === 'admin';

  const loadAdminData = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setError('Sign in again to review applications.');
        setApplications([]);
        setProfiles([]);
        return;
      }

      setSessionUserId(session.user.id);

      const [{ data: sessionProfile, error: sessionProfileError }, { data, error: loadError }, { data: profileRows, error: profileError }] = await Promise.all([
        supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle(),
        supabase
          .from('applications')
          .select('id, profile_id, callsign, timezone, status, created_at, reviewed_at, reviewed_by, profile:profiles!applications_profile_id_fkey(discord_username, roblox_username)')
          .order('created_at', { ascending: false }),
        supabase
          .from('profiles')
          .select('id, discord_username, roblox_username, role, created_at')
          .order('created_at', { ascending: false })
      ]);

      if (sessionProfileError) {
        throw sessionProfileError;
      }

      setSessionRole(sessionProfile?.role || null);

      if (loadError) {
        throw loadError;
      }

      if (profileError) {
        throw profileError;
      }

      setApplications((data || []) as ApplicationReviewRow[]);
      setProfiles((profileRows || []) as ProfileRoleRow[]);
    } catch (loadErr) {
      const message = loadErr instanceof Error ? loadErr.message : 'Unable to load applications.';
      setError(message);
      setApplications([]);
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAdminData();
  }, []);

  const reviewApplication = async (application: ApplicationReviewRow, nextStatus: 'approved' | 'rejected') => {
    setActiveId(application.id);
    setError(null);

    try {
      const now = new Date().toISOString();
      const { error: updateError } = await supabase
        .from('applications')
        .update({
          status: nextStatus,
          reviewed_by: sessionUserId,
          reviewed_at: now
        })
        .eq('id', application.id);

      if (updateError) {
        throw updateError;
      }

      if (nextStatus === 'approved') {
        const { error: rosterError } = await supabase
          .from('roster')
          .upsert({
            profile_id: application.profile_id,
            rank: 'SSGT',
            callsign: application.callsign
          }, { onConflict: 'profile_id' });

        if (rosterError) {
          throw rosterError;
        }
      }

      await loadAdminData();
    } catch (reviewErr) {
      const message = reviewErr instanceof Error ? reviewErr.message : 'Unable to review this application right now.';
      setError(message);
    } finally {
      setActiveId(null);
    }
  };

  const updateUserRole = async (profileId: string, nextRole: 'member' | 'officer' | 'admin') => {
    setActiveRoleId(profileId);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ role: nextRole })
        .eq('id', profileId);

      if (updateError) {
        throw updateError;
      }

      await loadAdminData();
    } catch (updateErr) {
      const message = updateErr instanceof Error ? updateErr.message : 'Unable to update role right now.';
      setError(message);
    } finally {
      setActiveRoleId(null);
    }
  };

  return (
    <section className="space-y-8">
      <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
        <div className="text-[10px] uppercase tracking-[0.35em] text-slate-400">Administration</div>
        <h2 className="mt-2 text-3xl font-semibold uppercase tracking-[0.2em] text-silver">Admin Panel</h2>
      </div>

      <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
        <h3 className="text-lg font-semibold uppercase tracking-[0.3em] text-silver">Application Review</h3>
        <p className="mt-2 text-sm text-slate-300">Pending requests: <span className="font-semibold text-silver">{pendingCount}</span></p>
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowHistory((current) => !current)}
            className="rounded border border-slateBlue/70 px-3 py-2 text-xs uppercase tracking-[0.3em] text-slate-300"
          >
            {showHistory ? 'Hide History' : 'Show History'}
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        {loading ? (
          <p className="mt-4 text-sm text-slate-400">Loading applications...</p>
        ) : pendingApplications.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">No applicants are currently waiting for a response.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {pendingApplications.map((application) => {
              const displayName = application.profile?.roblox_username || application.profile?.discord_username || application.callsign;
              const busy = activeId === application.id;

              return (
                <div key={application.id} className="rounded border border-slateBlue/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-silver">{displayName}</div>
                      <div className="mt-1 text-xs uppercase tracking-[0.25em] text-slate-400">{application.status}</div>
                    </div>
                    <div className="text-xs text-slate-400">Submitted: {prettyDate(application.created_at)}</div>
                  </div>

                  <div className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                    <div>Callsign: <span className="text-silver">{application.callsign}</span></div>
                    <div>Timezone: <span className="text-silver">{application.timezone}</span></div>
                    <div className="sm:col-span-2">Reviewed: <span className="text-silver">{application.reviewed_at ? prettyDate(application.reviewed_at) : 'Not reviewed yet'}</span></div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => void reviewApplication(application, 'approved')}
                      disabled={busy}
                      className="rounded border border-emerald-500/60 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-200 disabled:opacity-60"
                    >
                      {busy ? 'Working...' : 'Approve'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void reviewApplication(application, 'rejected')}
                      disabled={busy}
                      className="rounded border border-red-500/60 bg-red-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-red-200 disabled:opacity-60"
                    >
                      {busy ? 'Working...' : 'Reject'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {showHistory && !loading && (
          <div className="mt-6 rounded border border-slateBlue/60 p-4">
            <h4 className="text-sm font-semibold uppercase tracking-[0.3em] text-silver">Application History</h4>
            {reviewedApplications.length === 0 ? (
              <p className="mt-3 text-sm text-slate-400">No approved or rejected applications yet.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {reviewedApplications.map((application) => {
                  const displayName = application.profile?.roblox_username || application.profile?.discord_username || application.callsign;
                  return (
                    <div key={application.id} className="rounded border border-slateBlue/50 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="font-semibold text-silver">{displayName}</div>
                        <div className="text-xs uppercase tracking-[0.25em] text-slate-300">{application.status}</div>
                      </div>
                      <div className="mt-2 text-sm text-slate-300">Callsign: <span className="text-silver">{application.callsign}</span></div>
                      <div className="mt-1 text-sm text-slate-300">Reviewed: <span className="text-silver">{prettyDate(application.reviewed_at)}</span></div>
                      <div className="mt-1 text-xs text-slate-400">Submitted: {prettyDate(application.created_at)}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
        <h3 className="text-lg font-semibold uppercase tracking-[0.3em] text-silver">User Role Management</h3>
        {!canManageRoles ? (
          <p className="mt-3 text-sm text-slate-400">Only admins can manage user roles.</p>
        ) : loading ? (
          <p className="mt-3 text-sm text-slate-400">Loading users...</p>
        ) : profiles.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">No users found.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {profiles.map((profile) => {
              const displayName = profile.roblox_username || profile.discord_username || profile.id;
              const isSelf = profile.id === sessionUserId;
              const busy = activeRoleId === profile.id;

              return (
                <div key={profile.id} className="rounded border border-slateBlue/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-silver">{displayName}</div>
                      <div className="mt-1 text-xs uppercase tracking-[0.25em] text-slate-400">Current role: {profile.role}</div>
                    </div>
                    <div className="text-xs text-slate-400">Joined: {prettyDate(profile.created_at)}</div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void updateUserRole(profile.id, 'admin')}
                      disabled={busy || isSelf}
                      className="rounded border border-emerald-500/60 bg-emerald-500/10 px-3 py-2 text-xs uppercase tracking-[0.25em] text-emerald-200 disabled:opacity-60"
                    >
                      {busy ? 'Working...' : 'Promote to Admin'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void updateUserRole(profile.id, 'officer')}
                      disabled={busy || isSelf}
                      className="rounded border border-slateBlue/70 px-3 py-2 text-xs uppercase tracking-[0.25em] text-slate-300 disabled:opacity-60"
                    >
                      Set Officer
                    </button>
                    <button
                      type="button"
                      onClick={() => void updateUserRole(profile.id, 'member')}
                      disabled={busy || isSelf}
                      className="rounded border border-slateBlue/70 px-3 py-2 text-xs uppercase tracking-[0.25em] text-slate-300 disabled:opacity-60"
                    >
                      Set Member
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
