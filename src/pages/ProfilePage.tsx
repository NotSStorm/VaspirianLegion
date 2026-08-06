import { useEffect, useMemo, useState } from 'react';
import { Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getAuthenticatedState } from '../lib/auth';
import { MEDAL_OPTIONS } from '../lib/medals';
import { supabase } from '../lib/supabase';

const GROUP_ID = '5531725';
const COMPANY_OPTIONS = ['82nd Pirkland', '87th Melrose', 'Battery Command', 'Unassigned'];

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
  group_rank?: string | null;
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

type OverallStatRank = {
  rank: number | null;
  totalParticipants: number;
};

type CareerStatRanks = {
  kills: OverallStatRank;
  deaths: OverallStatRank;
  assists: OverallStatRank;
  events: OverallStatRank;
};

function normalizeName(value?: string | null) {
  return String(value || '').trim().replace(/[_\s]+/g, '').toLowerCase();
}

async function resolveGroupRank(robloxId?: string | null, robloxUsername?: string | null, fallbackRank = 'Unranked') {
  try {
    const response = await fetch('/api/roblox/user-rank', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        robloxId,
        robloxUsername,
        groupId: GROUP_ID
      })
    });

    if (!response.ok) {
      return fallbackRank;
    }

    const payload = await response.json().catch(() => ({}));
    return payload?.rank ? String(payload.rank) : fallbackRank;
  } catch {
    return fallbackRank;
  }
}

async function loadAvatarUrl(robloxId?: string | null, robloxUsername?: string | null) {
  try {
    const response = await fetch('/api/roblox/avatar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ robloxId, robloxUsername })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { resolvedId: payload?.robloxId ? String(payload.robloxId) : null, imageUrl: null };
    }

    return {
      resolvedId: payload?.robloxId ? String(payload.robloxId) : null,
      imageUrl: payload?.imageUrl ? String(payload.imageUrl) : null
    };
  } catch {
    return { resolvedId: null, imageUrl: null };
  }
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<HeaderProfile | null>(null);
  const [companyDraft, setCompanyDraft] = useState('');
  const [savingCompany, setSavingCompany] = useState(false);
  const [companyMessage, setCompanyMessage] = useState<string | null>(null);
  const [avatarCandidates, setAvatarCandidates] = useState<string[]>([]);
  const [avatarIndex, setAvatarIndex] = useState(0);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [logs, setLogs] = useState<BattleStatLog[]>([]);
  const [allStatLogs, setAllStatLogs] = useState<BattleStatLog[]>([]);
  const [battlesById, setBattlesById] = useState<Map<string, Battle>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [medalRequestSearch, setMedalRequestSearch] = useState('');
  const [selectedRequestedMedal, setSelectedRequestedMedal] = useState('');
  const [medalRequestNote, setMedalRequestNote] = useState('');
  const [submittingMedalRequest, setSubmittingMedalRequest] = useState(false);
  const [medalRequestMessage, setMedalRequestMessage] = useState<string | null>(null);
  const [logoutPending, setLogoutPending] = useState(false);

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
          .select('rank, group_rank, company')
          .eq('profile_id', authProfile.id)
          .maybeSingle();

        const resolvedGroupRank = await resolveGroupRank(
          authProfile.roblox_id || null,
          authProfile.roblox_username || null,
          (rosterRow as RosterRecord | null)?.group_rank || 'Not yet synced'
        );

        const currentProfile = {
          discordUsername: authProfile.discord_username || session.user.email || 'signed-in-user',
          robloxUsername: authProfile.roblox_username || null,
          robloxId: authProfile.roblox_id || null,
          callsign: authProfile.callsign || null,
          rank: authProfile.rank || null,
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
        const completeLogs = (statData || []) as BattleStatLog[];
        const battleMap = new Map<string, Battle>();
        ((battleData || []) as Battle[]).forEach((battle) => battleMap.set(battle.id, battle));
        setAvatarLoading(true);
        const avatarResult = await loadAvatarUrl(currentProfile.robloxId, currentProfile.robloxUsername);
        const candidates = [
          avatarResult.imageUrl,
          avatarResult.resolvedId ? `https://www.roblox.com/avatar-thumbnail/image?userId=${encodeURIComponent(avatarResult.resolvedId)}&width=420&height=420&format=png` : null,
          avatarResult.resolvedId ? `https://www.roblox.com/headshot-thumbnail/image?userId=${encodeURIComponent(avatarResult.resolvedId)}&width=420&height=420&format=png` : null
        ].filter((value): value is string => Boolean(value));

        if (!active) {
          return;
        }

        setProfile(currentProfile);
        setCompanyDraft(currentProfile.company || 'Unassigned');
        setLogs(filteredLogs);
        setAllStatLogs(completeLogs);
        setBattlesById(battleMap);
        setAvatarCandidates(candidates);
        setAvatarIndex(0);
      } catch (loadErr) {
        if (!active) {
          return;
        }
        setError(loadErr instanceof Error ? loadErr.message : 'Unable to load profile.');
      } finally {
        if (active) {
          setAvatarLoading(false);
          setLoading(false);
        }
      }
    };

    void loadProfile();

    return () => {
      active = false;
    };
  }, []);

  const saveCompanyPreference = async () => {
    if (!profile) {
      return;
    }

    const nextCompany = String(companyDraft || '').trim() || 'Unassigned';
    setSavingCompany(true);
    setCompanyMessage(null);

    try {
      const { profile: authProfile } = await getAuthenticatedState();
      if (!authProfile?.id) {
        throw new Error('You must be signed in to update your company.');
      }

      const [profileUpdate, rosterUpdate] = await Promise.all([
        supabase
          .from('profiles')
          .update({ company: nextCompany })
          .eq('id', authProfile.id),
        supabase
          .from('roster')
          .update({ company: nextCompany })
          .eq('profile_id', authProfile.id)
      ]);

      if (profileUpdate.error) {
        throw profileUpdate.error;
      }

      if (rosterUpdate.error) {
        throw rosterUpdate.error;
      }

      setProfile({ ...profile, company: nextCompany });
      setCompanyMessage('Company updated.');
    } catch (updateError) {
      setCompanyMessage(updateError instanceof Error ? updateError.message : 'Unable to update company.');
    } finally {
      setSavingCompany(false);
    }
  };

  const careerTotals = useMemo(() => logs.reduce((accumulator, entry) => ({
    kills: accumulator.kills + (Number(entry.kills) || 0),
    deaths: accumulator.deaths + (Number(entry.deaths) || 0),
    assists: accumulator.assists + (Number(entry.assists) || 0)
  }), { kills: 0, deaths: 0, assists: 0 }), [logs]);

  const careerEventsAttended = useMemo(() => new Set(logs.map((entry) => entry.battle_id).filter(Boolean)).size, [logs]);

  const careerStatRanks = useMemo<CareerStatRanks>(() => {
    const aliases = [profile?.robloxUsername, profile?.discordUsername, profile?.callsign]
      .map((value) => normalizeName(value))
      .filter(Boolean);
    const aliasSet = new Set(aliases);

    const byParticipant = new Map<string, { kills: number; deaths: number; assists: number; battleIds: Set<string> }>();
    allStatLogs.forEach((entry) => {
      const nameKey = normalizeName(entry.participant_name);
      if (!nameKey) {
        return;
      }

      if (!byParticipant.has(nameKey)) {
        byParticipant.set(nameKey, {
          kills: 0,
          deaths: 0,
          assists: 0,
          battleIds: new Set<string>()
        });
      }

      const bucket = byParticipant.get(nameKey);
      if (!bucket) {
        return;
      }

      bucket.kills += Number(entry.kills) || 0;
      bucket.deaths += Number(entry.deaths) || 0;
      bucket.assists += Number(entry.assists) || 0;
      if (entry.battle_id) {
        bucket.battleIds.add(entry.battle_id);
      }
    });

    const competitors = Array.from(byParticipant.entries())
      .filter(([name]) => !aliasSet.has(name))
      .map(([, totals]) => ({
        kills: totals.kills,
        deaths: totals.deaths,
        assists: totals.assists,
        events: totals.battleIds.size
      }));

    competitors.push({
      kills: careerTotals.kills,
      deaths: careerTotals.deaths,
      assists: careerTotals.assists,
      events: careerEventsAttended
    });

    const buildRank = (field: 'kills' | 'deaths' | 'assists' | 'events', value: number): OverallStatRank => {
      if (!Number.isFinite(value) || value <= 0) {
        return {
          rank: null,
          totalParticipants: competitors.length
        };
      }

      const higherCount = competitors.filter((entry) => Number(entry[field]) > value).length;
      return {
        rank: higherCount + 1,
        totalParticipants: competitors.length
      };
    };

    return {
      kills: buildRank('kills', careerTotals.kills),
      deaths: buildRank('deaths', careerTotals.deaths),
      assists: buildRank('assists', careerTotals.assists),
      events: buildRank('events', careerEventsAttended)
    };
  }, [allStatLogs, careerEventsAttended, careerTotals, profile]);

  const formatOverallRank = (value: OverallStatRank) => {
    if (!value.rank) {
      return 'Overall Rank: Unranked';
    }

    return `Overall Rank: #${value.rank} of ${value.totalParticipants}`;
  };

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

  const filteredMedalRequestOptions = useMemo(() => {
    const query = medalRequestSearch.trim().toLowerCase();
    if (!query) {
      return MEDAL_OPTIONS.slice(0, 6);
    }

    return MEDAL_OPTIONS
      .filter((option) => [option.name, option.category].join(' ').toLowerCase().includes(query))
      .slice(0, 10);
  }, [medalRequestSearch]);

  const submitMedalRequest = async () => {
    setMedalRequestMessage(null);

    try {
      if (!selectedRequestedMedal) {
        setMedalRequestMessage('Select a medal to request.');
        return;
      }

      const { profile: authProfile } = await getAuthenticatedState();
      if (!authProfile?.id) {
        setMedalRequestMessage('You must be signed in to submit a medal request.');
        return;
      }

      setSubmittingMedalRequest(true);

      const { error: insertError } = await supabase
        .from('medal_requests')
        .insert({
          requester_profile_id: authProfile.id,
          medal_name: selectedRequestedMedal,
          request_note: String(medalRequestNote || '').trim() || null,
          status: 'pending'
        });

      if (insertError) {
        throw insertError;
      }

      setSelectedRequestedMedal('');
      setMedalRequestNote('');
      setMedalRequestSearch('');
      setMedalRequestMessage('Medal request submitted for admin review.');
    } catch (requestError) {
      setMedalRequestMessage(requestError instanceof Error ? requestError.message : 'Unable to submit medal request.');
    } finally {
      setSubmittingMedalRequest(false);
    }
  };

  const handleLogout = async () => {
    if (logoutPending) {
      return;
    }

    try {
      setLogoutPending(true);
      await supabase.auth.signOut();
      navigate('/login', { replace: true });
    } finally {
      setLogoutPending(false);
    }
  };

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
                  {avatarLoading ? (
                    <div className="h-full w-full animate-pulse bg-slateBlue/30" />
                  ) : avatarCandidates[avatarIndex] ? (
                    <img
                      src={avatarCandidates[avatarIndex]}
                      alt="Roblox avatar"
                      className="h-full w-full object-cover"
                      onLoad={() => setAvatarLoading(false)}
                      onError={() => setAvatarIndex((current) => current + 1)}
                    />
                  ) : (
                    <Shield className="h-12 w-12 text-slate-400" />
                  )}
                </div>
                <div className="mt-4 text-xl font-semibold uppercase tracking-[0.2em] text-silver">{profile?.robloxUsername || profile?.discordUsername || 'Member'}</div>
                <div className="mt-2 text-sm text-slate-300">{profile?.groupRank || 'Not yet synced'}{profile?.company ? ` • ${profile.company}` : ''}</div>
                {profile?.callsign && <div className="mt-1 text-xs uppercase tracking-[0.3em] text-slate-400">{profile.callsign}</div>}
                <div className="mt-4 w-full text-left">
                  <label htmlFor="profile-company" className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Company Preference</label>
                  <select
                    id="profile-company"
                    value={companyDraft}
                    onChange={(event) => setCompanyDraft(event.target.value)}
                    className="mt-2 w-full rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver"
                    disabled={savingCompany}
                  >
                    {COMPANY_OPTIONS.map((company) => (
                      <option key={company} value={company}>{company}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void saveCompanyPreference()}
                    disabled={savingCompany || !companyDraft || companyDraft === (profile?.company || 'Unassigned')}
                    className="mt-3 w-full rounded border border-slateBlue/70 px-3 py-2 text-xs uppercase tracking-[0.25em] text-slate-200 disabled:opacity-60"
                  >
                    {savingCompany ? 'Saving...' : 'Save Company'}
                  </button>
                  {companyMessage && <p className="mt-2 text-xs text-slate-300">{companyMessage}</p>}
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded border border-slateBlue/70 bg-[#141a24] p-5">
                <div className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Career Kills</div>
                <div className="mt-2 font-mono text-3xl font-semibold text-silver">{careerTotals.kills}</div>
                <div className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-400">{formatOverallRank(careerStatRanks.kills)}</div>
              </div>
              <div className="rounded border border-slateBlue/70 bg-[#141a24] p-5">
                <div className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Career Deaths</div>
                <div className="mt-2 font-mono text-3xl font-semibold text-silver">{careerTotals.deaths}</div>
                <div className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-400">{formatOverallRank(careerStatRanks.deaths)}</div>
              </div>
              <div className="rounded border border-slateBlue/70 bg-[#141a24] p-5">
                <div className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Career Assists</div>
                <div className="mt-2 font-mono text-3xl font-semibold text-silver">{careerTotals.assists}</div>
                <div className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-400">{formatOverallRank(careerStatRanks.assists)}</div>
              </div>
              <div className="rounded border border-slateBlue/70 bg-[#141a24] p-5">
                <div className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Career Events Attended</div>
                <div className="mt-2 font-mono text-3xl font-semibold text-silver">{careerEventsAttended}</div>
                <div className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-400">{formatOverallRank(careerStatRanks.events)}</div>
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

          <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
            <div className="text-[10px] uppercase tracking-[0.35em] text-slate-400">Request Medal</div>
            <h3 className="mt-2 text-lg font-semibold uppercase tracking-[0.2em] text-silver">Submit Medal Review Request</h3>
            <p className="mt-2 text-sm text-slate-300">If you are missing a medal, submit a request and admin staff will review it.</p>

            <div className="mt-4 grid gap-3">
              <label className="text-xs text-slate-400">
                Search Medal
                <input
                  value={medalRequestSearch}
                  onChange={(event) => setMedalRequestSearch(event.target.value)}
                  placeholder="Search medal or category"
                  className="mt-1 w-full rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver"
                />
              </label>
              <div className="max-h-56 overflow-auto rounded border border-slateBlue/60 bg-[#0d121b] p-2">
                {filteredMedalRequestOptions.map((option) => (
                  <button
                    key={`request:${option.name}`}
                    type="button"
                    onClick={() => setSelectedRequestedMedal(option.name)}
                    className={`mb-1 block w-full rounded px-2 py-1 text-left text-sm ${selectedRequestedMedal === option.name ? 'bg-slateBlue/30 text-silver' : 'text-slate-300 hover:bg-slateBlue/20'}`}
                  >
                    {option.name}
                    <span className="ml-2 text-[10px] uppercase tracking-[0.2em] text-slate-500">{option.category}</span>
                  </button>
                ))}
              </div>
              <div className="text-xs text-slate-400">Selected medal: {selectedRequestedMedal || 'None'}</div>
              <textarea
                value={medalRequestNote}
                onChange={(event) => setMedalRequestNote(event.target.value)}
                placeholder="Optional note (battle date, evidence, context)"
                className="min-h-[100px] rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver"
              />
              <button
                type="button"
                onClick={() => void submitMedalRequest()}
                disabled={submittingMedalRequest}
                className="rounded border border-silver/50 bg-silver px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slateBlue disabled:opacity-60"
              >
                {submittingMedalRequest ? 'Submitting...' : 'Submit Medal Request'}
              </button>
              {medalRequestMessage && <p className="text-sm text-slate-300">{medalRequestMessage}</p>}
            </div>
          </div>

          <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
            <div className="text-[10px] uppercase tracking-[0.35em] text-slate-400">Account</div>
            <h3 className="mt-2 text-lg font-semibold uppercase tracking-[0.2em] text-silver">Session Controls</h3>
            <p className="mt-2 text-sm text-slate-300">Sign out from this device when you are done.</p>
            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={logoutPending}
              className="mt-4 w-full rounded border border-slateBlue/70 px-3 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-200 transition hover:border-silver/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {logoutPending ? 'Signing out...' : 'Logout'}
            </button>
          </div>
        </>
      )}
    </section>
  );
}