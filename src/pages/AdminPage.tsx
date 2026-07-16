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

function prettyDate(value?: string | null) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function AdminPage() {
  const [applications, setApplications] = useState<ApplicationReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);

  const pendingCount = useMemo(
    () => applications.filter((application) => application.status === 'pending').length,
    [applications]
  );

  const loadApplications = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setError('Sign in again to review applications.');
        setApplications([]);
        return;
      }

      setSessionUserId(session.user.id);

      const { data, error: loadError } = await supabase
        .from('applications')
        .select('id, profile_id, callsign, timezone, status, created_at, reviewed_at, reviewed_by, profile:profiles!applications_profile_id_fkey(discord_username, roblox_username)')
        .order('created_at', { ascending: false });

      if (loadError) {
        throw loadError;
      }

      setApplications((data || []) as ApplicationReviewRow[]);
    } catch (loadErr) {
      const message = loadErr instanceof Error ? loadErr.message : 'Unable to load applications.';
      setError(message);
      setApplications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadApplications();
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

      await loadApplications();
    } catch (reviewErr) {
      const message = reviewErr instanceof Error ? reviewErr.message : 'Unable to review this application right now.';
      setError(message);
    } finally {
      setActiveId(null);
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
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        {loading ? (
          <p className="mt-4 text-sm text-slate-400">Loading applications...</p>
        ) : applications.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">No applications have been submitted yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {applications.map((application) => {
              const displayName = application.profile?.roblox_username || application.profile?.discord_username || application.callsign;
              const isPending = application.status === 'pending';
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

                  {isPending && (
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
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
