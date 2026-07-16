import { useEffect, useState } from 'react';
import MedalCard from '../components/shared/MedalCard';
import { getAuthenticatedState } from '../lib/auth';
import { supabase } from '../lib/supabase';

type MedalRecord = {
  id: string;
  recipient_profile_id?: string | null;
  medal_name: string;
  citation: string;
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
  const [form, setForm] = useState({
    recipientProfileId: '',
    medalName: '',
    citation: '',
    campaignTag: '',
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
    try {
      const { error: insertError } = await supabase.from('medals').insert({
        recipient_profile_id: form.recipientProfileId || null,
        medal_name: form.medalName,
        citation: form.citation,
        campaign_tag: form.campaignTag,
        date_awarded: form.dateAwarded,
        status_tags: form.statusTags.split(',').map((value) => value.trim()).filter(Boolean)
      });
      if (insertError) throw insertError;

      setForm({
        recipientProfileId: '',
        medalName: '',
        citation: '',
        campaignTag: '',
        dateAwarded: '',
        statusTags: 'Declassified'
      });

      await loadMedals();
    } catch (saveErr) {
      setError(saveErr instanceof Error ? saveErr.message : 'Unable to add medal.');
    }
  };

  return (
    <section className="space-y-6">
      <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
        <div className="text-[10px] uppercase tracking-[0.35em] text-slate-400">Medals & Commendations</div>
        <h2 className="mt-2 text-3xl font-semibold uppercase tracking-[0.2em] text-silver">Honors</h2>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
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
        <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
          <h3 className="text-lg font-semibold uppercase tracking-[0.3em] text-silver">Add Medal</h3>
          <div className="mt-4 grid gap-3">
            <select value={form.recipientProfileId} onChange={(event) => setForm((prev) => ({ ...prev, recipientProfileId: event.target.value }))} className="rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver">
              <option value="">Recipient</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>{profile.roblox_username || profile.discord_username || profile.id}</option>
              ))}
            </select>
            <input value={form.medalName} onChange={(event) => setForm((prev) => ({ ...prev, medalName: event.target.value }))} placeholder="Medal name" className="rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver" />
            <input value={form.campaignTag} onChange={(event) => setForm((prev) => ({ ...prev, campaignTag: event.target.value }))} placeholder="Campaign tag" className="rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver" />
            <input value={form.dateAwarded} onChange={(event) => setForm((prev) => ({ ...prev, dateAwarded: event.target.value }))} placeholder="Date awarded" className="rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver" />
            <input value={form.statusTags} onChange={(event) => setForm((prev) => ({ ...prev, statusTags: event.target.value }))} placeholder="Status tags (comma-separated)" className="rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver" />
            <textarea value={form.citation} onChange={(event) => setForm((prev) => ({ ...prev, citation: event.target.value }))} placeholder="Citation" className="min-h-[100px] rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver" />
            <button type="button" onClick={() => void addMedal()} className="rounded border border-silver/50 bg-silver px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slateBlue">Save Medal</button>
          </div>
        </div>
      )}
    </section>
  );
}
