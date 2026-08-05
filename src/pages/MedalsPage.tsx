import { useEffect, useMemo, useState } from 'react';
import MedalCard from '../components/shared/MedalCard';
import { getAuthenticatedState } from '../lib/auth';
import { MEDAL_OPTIONS } from '../lib/medals';
import { supabase } from '../lib/supabase';

type MedalRecord = {
  id: string;
  recipient_profile_id?: string | null;
  medal_name: string;
  citation?: string;
  campaign_tag: string;
  date_awarded: string;
  status_tags: string[];
  recipient?: {
    roblox_username?: string | null;
    discord_username?: string | null;
  } | null;
};

type ProfileOption = {
  id: string;
  label: string;
};

type MedalRequestRecord = {
  id: string;
  requester_profile_id: string;
  medal_name: string;
  request_note: string | null;
  status: string;
  created_at: string;
};

function formatDateTime(value?: string | null) {
  if (!value) return 'N/A';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

export default function MedalsPage() {
  const [medals, setMedals] = useState<MedalRecord[]>([]);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [isStaff, setIsStaff] = useState(false);
  const [visibleMedalCount, setVisibleMedalCount] = useState(12);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [recipientSearch, setRecipientSearch] = useState('');
  const [medalSearch, setMedalSearch] = useState('');
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([]);
  const [selectedMedalName, setSelectedMedalName] = useState('');
  const [dateAwarded, setDateAwarded] = useState('');

  const [singleRecipientSearch, setSingleRecipientSearch] = useState('');
  const [singleMedalSearch, setSingleMedalSearch] = useState('');
  const [singleRecipientId, setSingleRecipientId] = useState('');
  const [selectedMedalNames, setSelectedMedalNames] = useState<string[]>([]);
  const [singleDateAwarded, setSingleDateAwarded] = useState('');

  const [pendingMedalRequests, setPendingMedalRequests] = useState<MedalRequestRecord[]>([]);

  const loadMedals = async () => {
    setError(null);
    try {
      const { profile } = await getAuthenticatedState();
      const staff = profile?.role === 'admin' || profile?.role === 'officer';
      setIsStaff(staff);

      const [{ data: medalData, error: medalError }, { data: profileData, error: profileError }, requestsResponse] = await Promise.all([
        supabase
          .from('medals')
          .select('id, recipient_profile_id, medal_name, citation, campaign_tag, date_awarded, status_tags, recipient:profiles!medals_recipient_profile_id_fkey(roblox_username, discord_username)')
          .order('date_awarded', { ascending: false }),
        supabase.from('profiles').select('id, roblox_username, discord_username').order('created_at', { ascending: true }),
        supabase
          .from('medal_requests')
          .select('id, requester_profile_id, medal_name, request_note, status, created_at')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
      ]);

      if (medalError) throw medalError;
      if (profileError) throw profileError;
      if (requestsResponse.error && !/does not exist|relation/i.test(requestsResponse.error.message)) {
        throw requestsResponse.error;
      }

      setMedals((medalData || []) as MedalRecord[]);
      setProfiles(
        (profileData || []).map((entry) => ({
          id: String(entry.id),
          label: String(entry.roblox_username || entry.discord_username || entry.id)
        }))
      );
      setPendingMedalRequests((requestsResponse.data || []) as MedalRequestRecord[]);
    } catch (loadErr) {
      setError(loadErr instanceof Error ? loadErr.message : 'Unable to load medals.');
      setMedals([]);
      setProfiles([]);
      setPendingMedalRequests([]);
    }
  };

  useEffect(() => {
    void loadMedals();
  }, []);

  const hasPastMedals = medals.length > visibleMedalCount;
  const visibleMedals = useMemo(() => medals.slice(0, visibleMedalCount), [medals, visibleMedalCount]);
  const canResetMedalList = visibleMedalCount > 12;

  const filteredRecipientsForMany = useMemo(() => {
    const query = recipientSearch.trim().toLowerCase();
    if (!query) return profiles.slice(0, 8);
    return profiles.filter((profile) => profile.label.toLowerCase().includes(query)).slice(0, 8);
  }, [profiles, recipientSearch]);

  const filteredRecipientsForSingle = useMemo(() => {
    const query = singleRecipientSearch.trim().toLowerCase();
    if (!query) return profiles.slice(0, 8);
    return profiles.filter((profile) => profile.label.toLowerCase().includes(query)).slice(0, 8);
  }, [profiles, singleRecipientSearch]);

  const filteredMedalsForOne = useMemo(() => {
    const query = medalSearch.trim().toLowerCase();
    if (!query) return MEDAL_OPTIONS.slice(0, 8);
    return MEDAL_OPTIONS.filter((option) => [option.name, option.category].join(' ').toLowerCase().includes(query)).slice(0, 12);
  }, [medalSearch]);

  const filteredMedalsForSingle = useMemo(() => {
    const query = singleMedalSearch.trim().toLowerCase();
    if (!query) return MEDAL_OPTIONS.slice(0, 8);
    return MEDAL_OPTIONS.filter((option) => [option.name, option.category].join(' ').toLowerCase().includes(query)).slice(0, 12);
  }, [singleMedalSearch]);

  const selectedRecipients = useMemo(
    () => selectedRecipientIds.map((id) => profiles.find((profile) => profile.id === id)).filter(Boolean) as ProfileOption[],
    [profiles, selectedRecipientIds]
  );

  const selectedSingleRecipient = useMemo(
    () => profiles.find((profile) => profile.id === singleRecipientId) || null,
    [profiles, singleRecipientId]
  );

  const addRecipient = (profileId: string) => {
    setSelectedRecipientIds((current) => (current.includes(profileId) ? current : [...current, profileId]));
  };

  const removeRecipient = (profileId: string) => {
    setSelectedRecipientIds((current) => current.filter((value) => value !== profileId));
  };

  const addMedalToSingleRecipient = (medalName: string) => {
    setSelectedMedalNames((current) => (current.includes(medalName) ? current : [...current, medalName]));
  };

  const removeMedalFromSingleRecipient = (medalName: string) => {
    setSelectedMedalNames((current) => current.filter((value) => value !== medalName));
  };

  const assignOneMedalToMany = async () => {
    setError(null);
    setSuccess(null);

    try {
      if (!selectedMedalName) {
        setError('Select a medal.');
        return;
      }

      if (selectedRecipientIds.length === 0) {
        setError('Add at least one recipient.');
        return;
      }

      const selectedDate = String(dateAwarded || '').trim();
      if (!selectedDate) {
        setError('Provide a date awarded.');
        return;
      }

      const selectedMedal = MEDAL_OPTIONS.find((option) => option.name === selectedMedalName) || null;
      if (!selectedMedal) {
        setError('Selected medal is invalid.');
        return;
      }

      const uniqueRecipientIds = Array.from(new Set(selectedRecipientIds));
      const { data: existingMedals, error: existingMedalsError } = await supabase
        .from('medals')
        .select('recipient_profile_id')
        .eq('medal_name', selectedMedalName)
        .in('recipient_profile_id', uniqueRecipientIds);

      if (existingMedalsError) throw existingMedalsError;

      const existingRecipientIds = new Set(
        (existingMedals || []).map((medal) => String(medal.recipient_profile_id || '').trim()).filter(Boolean)
      );
      const recipientsToInsert = uniqueRecipientIds.filter((profileId) => !existingRecipientIds.has(profileId));

      if (recipientsToInsert.length === 0) {
        setError('Skipped: every selected recipient already has this medal.');
        return;
      }

      const { error: insertError } = await supabase.from('medals').insert(
        recipientsToInsert.map((profileId) => ({
          recipient_profile_id: profileId,
          medal_name: selectedMedalName,
          citation: '',
          campaign_tag: selectedMedal.category,
          date_awarded: selectedDate,
          status_tags: ['Declassified']
        }))
      );

      if (insertError) throw insertError;

      const skippedCount = uniqueRecipientIds.length - recipientsToInsert.length;
      setSuccess(
        skippedCount > 0
          ? `Assigned ${recipientsToInsert.length} medal entries. Skipped ${skippedCount} duplicate recipient(s).`
          : `Assigned ${recipientsToInsert.length} medal entries.`
      );

      setSelectedRecipientIds([]);
      setSelectedMedalName('');
      setDateAwarded('');
      setRecipientSearch('');
      setMedalSearch('');
      await loadMedals();
    } catch (saveErr) {
      setError(saveErr instanceof Error ? saveErr.message : 'Unable to add medal.');
    }
  };

  const assignManyMedalsToOne = async () => {
    setError(null);
    setSuccess(null);

    try {
      const recipientProfileId = String(singleRecipientId || '').trim();
      if (!recipientProfileId) {
        setError('Select a recipient.');
        return;
      }

      if (selectedMedalNames.length === 0) {
        setError('Add at least one medal.');
        return;
      }

      const selectedDate = String(singleDateAwarded || '').trim();
      if (!selectedDate) {
        setError('Provide a date awarded.');
        return;
      }

      const uniqueMedalNames = Array.from(new Set(selectedMedalNames));
      const { data: existingMedals, error: existingMedalsError } = await supabase
        .from('medals')
        .select('medal_name')
        .eq('recipient_profile_id', recipientProfileId)
        .in('medal_name', uniqueMedalNames);

      if (existingMedalsError) throw existingMedalsError;

      const existingMedalNames = new Set((existingMedals || []).map((medal) => String(medal.medal_name || '').trim()).filter(Boolean));
      const medalNamesToInsert = uniqueMedalNames.filter((medalName) => !existingMedalNames.has(medalName));
      if (medalNamesToInsert.length === 0) {
        setError('Skipped: this recipient already has all selected medals.');
        return;
      }

      const insertRows = medalNamesToInsert.map((medalName) => {
        const medalOption = MEDAL_OPTIONS.find((option) => option.name === medalName) || null;
        if (!medalOption) {
          throw new Error(`Unrecognized medal: ${medalName}`);
        }

        return {
          recipient_profile_id: recipientProfileId,
          medal_name: medalName,
          citation: '',
          campaign_tag: medalOption.category,
          date_awarded: selectedDate,
          status_tags: ['Declassified']
        };
      });

      const { error: insertError } = await supabase.from('medals').insert(insertRows);
      if (insertError) throw insertError;

      const skippedCount = uniqueMedalNames.length - medalNamesToInsert.length;
      setSuccess(
        skippedCount > 0
          ? `Assigned ${insertRows.length} medal entries. Skipped ${skippedCount} duplicate medal(s).`
          : `Assigned ${insertRows.length} medal entries.`
      );

      setSingleRecipientId('');
      setSelectedMedalNames([]);
      setSingleDateAwarded('');
      setSingleRecipientSearch('');
      setSingleMedalSearch('');
      await loadMedals();
    } catch (saveErr) {
      setError(saveErr instanceof Error ? saveErr.message : 'Unable to add medals.');
    }
  };

  return (
    <section className="space-y-6">
      <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
        <div className="text-[10px] uppercase tracking-[0.35em] text-slate-400">Medals & Commendations</div>
        <h2 className="mt-2 text-3xl font-semibold uppercase tracking-[0.2em] text-silver">Honors</h2>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        {success && <p className="mt-3 text-sm text-emerald-300">{success}</p>}
        {pendingMedalRequests.length > 0 && (
          <p className="mt-2 text-xs uppercase tracking-[0.2em] text-amber-300">
            Pending medal requests: {pendingMedalRequests.length} {isStaff ? ' (review in Admin > Medal Requests)' : ''}
          </p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2" id="medals-list">
        {visibleMedals.map((medal) => (
          <MedalCard
            key={medal.id}
            recipient={medal.recipient?.roblox_username || medal.recipient?.discord_username || 'Unassigned'}
            medalName={medal.medal_name}
            citation={medal.citation}
            campaignTag={medal.campaign_tag}
            date={medal.date_awarded}
            status={medal.status_tags.join(', ')}
          />
        ))}
      </div>

      {hasPastMedals && (
        <div className="rounded border border-slateBlue/70 bg-[#141a24] p-4">
          <button
            type="button"
            aria-controls="medals-list"
            onClick={() => setVisibleMedalCount((current) => Math.min(current + 12, medals.length))}
            className="flex w-full items-center justify-between gap-3 text-left text-xs uppercase tracking-[0.3em] text-slate-300"
          >
            <span>Show 12 more medals</span>
            <span className="rounded border border-slateBlue/60 px-2 py-1 text-[10px] tracking-[0.3em] text-slate-400">
              {Math.min(12, medals.length - visibleMedalCount)}
            </span>
          </button>
        </div>
      )}

      {canResetMedalList && (
        <div className="rounded border border-slateBlue/70 bg-[#141a24] p-4">
          <button
            type="button"
            onClick={() => setVisibleMedalCount(12)}
            className="flex w-full items-center justify-between gap-3 text-left text-xs uppercase tracking-[0.3em] text-slate-300"
          >
            <span>Hide all extra medals</span>
            <span className="rounded border border-slateBlue/60 px-2 py-1 text-[10px] tracking-[0.3em] text-slate-400">
              Reset to 12
            </span>
          </button>
        </div>
      )}

      {isStaff && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
            <h3 className="text-lg font-semibold uppercase tracking-[0.3em] text-silver">One Medal to Many</h3>
            <div className="mt-4 grid gap-3">
              <label className="text-xs text-slate-400">
                Search People
                <input
                  value={recipientSearch}
                  onChange={(event) => setRecipientSearch(event.target.value)}
                  placeholder="Type Roblox/Discord name"
                  className="mt-1 w-full rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver"
                />
              </label>
              <div className="max-h-48 overflow-auto rounded border border-slateBlue/60 bg-[#0d121b] p-2">
                {filteredRecipientsForMany.map((profile) => (
                  <div key={`many:${profile.id}`} className="flex items-center justify-between gap-2 rounded px-2 py-1 hover:bg-slateBlue/20">
                    <span className="text-sm text-slate-200">{profile.label}</span>
                    <button
                      type="button"
                      onClick={() => addRecipient(profile.id)}
                      className="rounded border border-slateBlue/60 px-2 py-1 text-xs uppercase tracking-[0.2em] text-slate-200"
                    >
                      +
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedRecipients.map((profile) => (
                  <button
                    key={`sel:${profile.id}`}
                    type="button"
                    onClick={() => removeRecipient(profile.id)}
                    className="rounded border border-slateBlue/70 bg-[#0d121b] px-2 py-1 text-xs text-slate-200"
                  >
                    {profile.label} x
                  </button>
                ))}
                {selectedRecipients.length === 0 && <span className="text-xs text-slate-500">No recipients selected</span>}
              </div>

              <label className="text-xs text-slate-400">
                Search Medal
                <input
                  value={medalSearch}
                  onChange={(event) => setMedalSearch(event.target.value)}
                  placeholder="Search medal or category"
                  className="mt-1 w-full rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver"
                />
              </label>
              <div className="max-h-52 overflow-auto rounded border border-slateBlue/60 bg-[#0d121b] p-2">
                {filteredMedalsForOne.map((option) => (
                  <button
                    key={`one:${option.name}`}
                    type="button"
                    onClick={() => setSelectedMedalName(option.name)}
                    className={`mb-1 block w-full rounded px-2 py-1 text-left text-sm ${selectedMedalName === option.name ? 'bg-slateBlue/30 text-silver' : 'text-slate-300 hover:bg-slateBlue/20'}`}
                  >
                    {option.name}
                    <span className="ml-2 text-[10px] uppercase tracking-[0.2em] text-slate-500">{option.category}</span>
                  </button>
                ))}
              </div>
              <div className="text-xs text-slate-400">Selected medal: {selectedMedalName || 'None'}</div>

              <input
                type="date"
                value={dateAwarded}
                onChange={(event) => setDateAwarded(event.target.value)}
                className="rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver"
              />
              <button
                type="button"
                onClick={() => void assignOneMedalToMany()}
                className="rounded border border-silver/50 bg-silver px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slateBlue"
              >
                Assign Medal to Selected People
              </button>
            </div>
          </div>

          <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
            <h3 className="text-lg font-semibold uppercase tracking-[0.3em] text-silver">Many Medals to One</h3>
            <div className="mt-4 grid gap-3">
              <label className="text-xs text-slate-400">
                Search Recipient
                <input
                  value={singleRecipientSearch}
                  onChange={(event) => setSingleRecipientSearch(event.target.value)}
                  placeholder="Type Roblox/Discord name"
                  className="mt-1 w-full rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver"
                />
              </label>
              <div className="max-h-48 overflow-auto rounded border border-slateBlue/60 bg-[#0d121b] p-2">
                {filteredRecipientsForSingle.map((profile) => (
                  <div key={`single:${profile.id}`} className="flex items-center justify-between gap-2 rounded px-2 py-1 hover:bg-slateBlue/20">
                    <span className="text-sm text-slate-200">{profile.label}</span>
                    <button
                      type="button"
                      onClick={() => setSingleRecipientId(profile.id)}
                      className="rounded border border-slateBlue/60 px-2 py-1 text-xs uppercase tracking-[0.2em] text-slate-200"
                    >
                      +
                    </button>
                  </div>
                ))}
              </div>
              <div className="text-xs text-slate-400">Selected recipient: {selectedSingleRecipient?.label || 'None'}</div>

              <label className="text-xs text-slate-400">
                Search Medals
                <input
                  value={singleMedalSearch}
                  onChange={(event) => setSingleMedalSearch(event.target.value)}
                  placeholder="Search medal or category"
                  className="mt-1 w-full rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver"
                />
              </label>
              <div className="max-h-52 overflow-auto rounded border border-slateBlue/60 bg-[#0d121b] p-2">
                {filteredMedalsForSingle.map((option) => (
                  <div key={`many-medal:${option.name}`} className="mb-1 flex items-center justify-between gap-2 rounded px-2 py-1 hover:bg-slateBlue/20">
                    <div className="text-sm text-slate-300">
                      {option.name}
                      <span className="ml-2 text-[10px] uppercase tracking-[0.2em] text-slate-500">{option.category}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => addMedalToSingleRecipient(option.name)}
                      className="rounded border border-slateBlue/60 px-2 py-1 text-xs uppercase tracking-[0.2em] text-slate-200"
                    >
                      +
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedMedalNames.map((medalName) => (
                  <button
                    key={`sel-medal:${medalName}`}
                    type="button"
                    onClick={() => removeMedalFromSingleRecipient(medalName)}
                    className="rounded border border-slateBlue/70 bg-[#0d121b] px-2 py-1 text-xs text-slate-200"
                  >
                    {medalName} x
                  </button>
                ))}
                {selectedMedalNames.length === 0 && <span className="text-xs text-slate-500">No medals selected</span>}
              </div>

              <input
                type="date"
                value={singleDateAwarded}
                onChange={(event) => setSingleDateAwarded(event.target.value)}
                className="rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver"
              />
              <button
                type="button"
                onClick={() => void assignManyMedalsToOne()}
                className="rounded border border-silver/50 bg-silver px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slateBlue"
              >
                Assign Selected Medals
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingMedalRequests.length > 0 && (
        <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
          <h3 className="text-lg font-semibold uppercase tracking-[0.3em] text-silver">Recent Medal Requests</h3>
          <div className="mt-3 space-y-2">
            {pendingMedalRequests.slice(0, 5).map((request) => (
              <div key={request.id} className="rounded border border-slateBlue/60 bg-[#0d121b] p-3">
                <div className="text-sm font-semibold text-silver">{request.medal_name}</div>
                <div className="text-xs text-slate-400">Requested {formatDateTime(request.created_at)}</div>
                {request.request_note && <div className="mt-1 text-xs text-slate-300">{request.request_note}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
