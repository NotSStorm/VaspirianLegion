import { useEffect, useState } from 'react';
import MedalCard from '../components/shared/MedalCard';
import { getAuthenticatedState } from '../lib/auth';
import { medalOptionsByCategory, MEDAL_OPTIONS } from '../lib/medals';
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

export default function MedalsPage() {
  const [medals, setMedals] = useState<MedalRecord[]>([]);
  const [profiles, setProfiles] = useState<Array<{ id: string; roblox_username?: string | null; discord_username?: string | null }>>([]);
  const [isStaff, setIsStaff] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState({
    recipientProfileIds: [] as string[],
    medalName: '',
    dateAwarded: '',
    statusTags: 'Declassified'
  });
  const [inverseForm, setInverseForm] = useState({
    recipientProfileId: '',
    medalNames: [] as string[],
    dateAwarded: '',
    statusTags: 'Declassified'
  });

  const loadMedals = async () => {
    setError(null);
    try {
      const { profile } = await getAuthenticatedState();
      setIsStaff(profile?.role === 'admin' || profile?.role === 'officer');

      const [{ data: medalData, error: medalError }, { data: profileData, error: profileError }] = await Promise.all([
        supabase
          .from('medals')
          .select('id, recipient_profile_id, medal_name, citation, campaign_tag, date_awarded, status_tags, recipient:profiles!medals_recipient_profile_id_fkey(roblox_username, discord_username)')
          .order('date_awarded', { ascending: false }),
        supabase.from('profiles').select('id, roblox_username, discord_username').order('created_at', { ascending: true })
      ]);

      if (medalError) throw medalError;
      if (profileError) throw profileError;

      setMedals((medalData || []) as MedalRecord[]);
      setProfiles(profileData || []);
    } catch (loadErr) {
      setError(loadErr instanceof Error ? loadErr.message : 'Unable to load medals.');
      setMedals([]);
      setProfiles([]);
    }
  };

  useEffect(() => {
    void loadMedals();
  }, []);

  const addMedal = async () => {
    setError(null);
    setSuccess(null);
    try {
      const selectedMedal = MEDAL_OPTIONS.find((option) => option.name === form.medalName) || null;
      if (!selectedMedal) {
        setError('Select a medal from the approved Vaspiria list.');
        return;
      }

      if (form.recipientProfileIds.length === 0) {
        setError('Select one or more recipients.');
        return;
      }

      const selectedDate = String(form.dateAwarded || '').trim();
      if (!selectedDate) {
        setError('Provide a date awarded.');
        return;
      }

      const uniqueRecipientIds = Array.from(new Set(form.recipientProfileIds));
      const { data: existingMedals, error: existingMedalsError } = await supabase
        .from('medals')
        .select('recipient_profile_id, medal_name')
        .eq('medal_name', form.medalName)
        .in('recipient_profile_id', uniqueRecipientIds);

      if (existingMedalsError) throw existingMedalsError;

      const existingRecipientIds = new Set(
        (existingMedals || [])
          .map((medal) => String(medal.recipient_profile_id || '').trim())
          .filter(Boolean)
      );

      const recipientsToInsert = uniqueRecipientIds.filter((profileId) => !existingRecipientIds.has(profileId));

      if (recipientsToInsert.length === 0) {
        setError('Skipped: every selected recipient already has this medal.');
        return;
      }

      const insertRows = recipientsToInsert.map((profileId) => ({
        recipient_profile_id: profileId,
        medal_name: form.medalName,
        citation: '',
        campaign_tag: selectedMedal.category,
        date_awarded: selectedDate,
        status_tags: form.statusTags.split(',').map((value) => value.trim()).filter(Boolean)
      }));

      const { error: insertError } = await supabase.from('medals').insert(insertRows);
      if (insertError) throw insertError;

      const skippedCount = uniqueRecipientIds.length - recipientsToInsert.length;
      setSuccess(
        skippedCount > 0
          ? `Assigned ${insertRows.length} medal entries. Skipped ${skippedCount} duplicate recipient(s).`
          : `Assigned ${insertRows.length} medal entries.`
      );

      setForm({
        recipientProfileIds: [],
        medalName: '',
        dateAwarded: '',
        statusTags: 'Declassified'
      });

      await loadMedals();
    } catch (saveErr) {
      setError(saveErr instanceof Error ? saveErr.message : 'Unable to add medal.');
    }
  };

  const addManyMedalsToRecipient = async () => {
    setError(null);
    setSuccess(null);
    try {
      const recipientProfileId = String(inverseForm.recipientProfileId || '').trim();
      if (!recipientProfileId) {
        setError('Select a recipient.');
        return;
      }

      if (inverseForm.medalNames.length === 0) {
        setError('Select one or more medals.');
        return;
      }

      const selectedDate = String(inverseForm.dateAwarded || '').trim();
      if (!selectedDate) {
        setError('Provide a date awarded.');
        return;
      }

      const statusTags = inverseForm.statusTags.split(',').map((value) => value.trim()).filter(Boolean);
      const uniqueMedalNames = Array.from(new Set(inverseForm.medalNames));
      const { data: existingMedals, error: existingMedalsError } = await supabase
        .from('medals')
        .select('medal_name')
        .eq('recipient_profile_id', recipientProfileId)
        .in('medal_name', uniqueMedalNames);

      if (existingMedalsError) throw existingMedalsError;

      const existingMedalNames = new Set(
        (existingMedals || [])
          .map((medal) => String(medal.medal_name || '').trim())
          .filter(Boolean)
      );

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
          status_tags: statusTags
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

      setInverseForm({
        recipientProfileId: '',
        medalNames: [],
        dateAwarded: '',
        statusTags: 'Declassified'
      });

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
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {medals.map((medal) => (
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

      {isStaff && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
            <h3 className="text-lg font-semibold uppercase tracking-[0.3em] text-silver">One Medal to Many</h3>
            <div className="mt-4 grid gap-3">
              <label className="text-xs text-slate-400">
                Recipients
                <select
                  multiple
                  value={form.recipientProfileIds}
                  onChange={(event) => {
                    const selectedProfileIds = Array.from(event.target.selectedOptions).map((option) => option.value);
                    setForm((prev) => ({ ...prev, recipientProfileIds: selectedProfileIds }));
                  }}
                  className="mt-1 min-h-[12rem] w-full rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver"
                >
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>{profile.roblox_username || profile.discord_username || profile.id}</option>
                ))}
                </select>
              </label>
              <p className="text-xs text-slate-500">Selected recipients: {form.recipientProfileIds.length}</p>
              <select value={form.medalName} onChange={(event) => setForm((prev) => ({ ...prev, medalName: event.target.value }))} className="rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver">
                <option value="">Medal</option>
                {Object.entries(medalOptionsByCategory).map(([category, medals]) => (
                  <optgroup key={category} label={category}>
                    {medals.map((medal) => (
                      <option key={medal} value={medal}>{medal}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <input value={form.dateAwarded} onChange={(event) => setForm((prev) => ({ ...prev, dateAwarded: event.target.value }))} placeholder="Date awarded (e.g. 2026-08-05)" className="rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver" />
              <button type="button" onClick={() => void addMedal()} className="rounded border border-silver/50 bg-silver px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slateBlue">Assign Medal to Selected</button>
            </div>
          </div>

          <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
            <h3 className="text-lg font-semibold uppercase tracking-[0.3em] text-silver">Many Medals to One</h3>
            <div className="mt-4 grid gap-3">
              <select
                value={inverseForm.recipientProfileId}
                onChange={(event) => setInverseForm((prev) => ({ ...prev, recipientProfileId: event.target.value }))}
                className="rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver"
              >
                <option value="">Recipient</option>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>{profile.roblox_username || profile.discord_username || profile.id}</option>
                ))}
              </select>
              <label className="text-xs text-slate-400">
                Medals
                <select
                  multiple
                  value={inverseForm.medalNames}
                  onChange={(event) => {
                    const selectedMedals = Array.from(event.target.selectedOptions).map((option) => option.value);
                    setInverseForm((prev) => ({ ...prev, medalNames: selectedMedals }));
                  }}
                  className="mt-1 min-h-[12rem] w-full rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver"
                >
                  {Object.entries(medalOptionsByCategory).map(([category, medals]) => (
                    <optgroup key={category} label={category}>
                      {medals.map((medal) => (
                        <option key={medal} value={medal}>{medal}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              <p className="text-xs text-slate-500">Selected medals: {inverseForm.medalNames.length}</p>
              <input value={inverseForm.dateAwarded} onChange={(event) => setInverseForm((prev) => ({ ...prev, dateAwarded: event.target.value }))} placeholder="Date awarded (e.g. 2026-08-05)" className="rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver" />
              <button type="button" onClick={() => void addManyMedalsToRecipient()} className="rounded border border-silver/50 bg-silver px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slateBlue">Assign Selected Medals</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
