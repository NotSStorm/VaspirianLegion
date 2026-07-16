import { useEffect, useMemo, useState } from 'react';
import CommandSlotCard from '../components/shared/CommandSlotCard';
import { getAuthenticatedState } from '../lib/auth';
import { supabase } from '../lib/supabase';

type Slot = {
  id: string;
  tier: string;
  company: string;
  slot_title: string;
  profile_id?: string | null;
  sort_order: number;
  profile?: {
    roblox_username?: string | null;
    discord_username?: string | null;
  } | null;
};

const REQUIRED_STRUCTURE = [
  {
    tier: 'Grand Battery Command',
    company: 'Battery Command',
    titles: ['Commanding Officer', 'Executive Officer', 'Battery Assistant']
  },
  {
    tier: '82nd Pirkland',
    company: '82nd Pirkland',
    titles: ['Commander', 'Executive', 'Komendant des Flag']
  },
  {
    tier: '87th Melrose',
    company: '87th Melrose',
    titles: ['Commander', 'Executive', 'Gun Team Lead I', 'Gun Team Lead II', 'Gun Team Lead III']
  }
];

function normalizeSlotTitle(title: string) {
  if (title === 'Security Slot') return 'Komendant des Flag';
  if (title === 'Gun Team I') return 'Gun Team Lead I';
  if (title === 'Gun Team II') return 'Gun Team Lead II';
  if (title === 'Gun Team III') return 'Gun Team Lead III';
  return title;
}

export default function CommandPage() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [profiles, setProfiles] = useState<Array<{ id: string; roblox_username?: string | null; discord_username?: string | null }>>([]);
  const [isStaff, setIsStaff] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadCommandData = async () => {
    setLoading(true);
    setError(null);

    try {
      const { profile } = await getAuthenticatedState();
      setIsStaff(profile?.role === 'admin' || profile?.role === 'officer');

      const [{ data: slotData, error: slotError }, { data: profileData, error: profileError }] = await Promise.all([
        supabase
          .from('command_slots')
          .select('id, tier, company, slot_title, profile_id, sort_order, profile:profiles!command_slots_profile_id_fkey(roblox_username, discord_username)')
          .order('tier', { ascending: true })
          .order('sort_order', { ascending: true }),
        supabase.from('profiles').select('id, roblox_username, discord_username').order('created_at', { ascending: true })
      ]);

      if (slotError) throw slotError;
      if (profileError) throw profileError;

      setSlots(((slotData || []) as Slot[]).map((slot) => ({ ...slot, slot_title: normalizeSlotTitle(slot.slot_title) })));
      setProfiles(profileData || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load command slots.');
      setSlots([]);
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCommandData();
  }, []);

  const groupedTiers = useMemo(() => {
    const grouped = new Map<string, Slot[]>();
    slots.forEach((slot) => {
      const key = slot.tier || slot.company;
      const existing = grouped.get(key) || [];
      grouped.set(key, [...existing, slot]);
    });
    return Array.from(grouped.entries()).map(([title, entries]) => ({
      title,
      slots: entries.sort((a, b) => a.sort_order - b.sort_order)
    }));
  }, [slots]);

  const updateSlot = async (slot: Slot, patch: Partial<Slot>) => {
    setActiveSlotId(slot.id);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from('command_slots')
        .update({
          slot_title: patch.slot_title ?? slot.slot_title,
          profile_id: patch.profile_id === undefined ? slot.profile_id : patch.profile_id
        })
        .eq('id', slot.id);

      if (updateError) throw updateError;
      await loadCommandData();
    } catch (updateErr) {
      setError(updateErr instanceof Error ? updateErr.message : 'Unable to update slot.');
    } finally {
      setActiveSlotId(null);
    }
  };

  const ensureCommandStructure = async () => {
    setError(null);
    setActiveSlotId('seed');

    try {
      const legacyUpdates = slots
        .filter((slot) => normalizeSlotTitle(slot.slot_title) !== slot.slot_title)
        .map((slot) => supabase.from('command_slots').update({ slot_title: normalizeSlotTitle(slot.slot_title) }).eq('id', slot.id));
      await Promise.all(legacyUpdates);

      const payload: Array<{ tier: string; company: string; slot_title: string; sort_order: number }> = [];
      REQUIRED_STRUCTURE.forEach((group) => {
        const groupSlots = slots.filter((slot) => slot.tier === group.tier || slot.company === group.company);
        const existing = new Set(groupSlots.map((slot) => normalizeSlotTitle(slot.slot_title)));
        const baseSort = groupSlots.length ? Math.max(...groupSlots.map((slot) => slot.sort_order)) + 1 : 1;
        group.titles.forEach((title, index) => {
          if (!existing.has(title)) {
            payload.push({
              tier: group.tier,
              company: group.company,
              slot_title: title,
              sort_order: baseSort + index
            });
          }
        });
      });

      if (payload.length > 0) {
        const { error: insertError } = await supabase.from('command_slots').insert(payload);
        if (insertError) throw insertError;
      }

      await loadCommandData();
    } catch (seedErr) {
      setError(seedErr instanceof Error ? seedErr.message : 'Unable to ensure command structure.');
    } finally {
      setActiveSlotId(null);
    }
  };

  return (
    <section className="space-y-6">
      <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
        <div className="text-[10px] uppercase tracking-[0.35em] text-slate-400">Command Structure</div>
        <h2 className="mt-2 text-3xl font-semibold uppercase tracking-[0.2em] text-silver">ORBAT</h2>
        {isStaff && (
          <button
            type="button"
            onClick={() => void ensureCommandStructure()}
            disabled={activeSlotId === 'seed'}
            className="mt-4 rounded border border-slateBlue/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-silver disabled:opacity-60"
          >
            {activeSlotId === 'seed' ? 'Applying...' : 'Ensure Battery/Pirkland/Melrose Structure'}
          </button>
        )}
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </div>

      {loading ? (
        <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6 text-sm text-slate-400">Loading command structure...</div>
      ) : (
      <div className="grid gap-6 lg:grid-cols-3">
        {groupedTiers.map((tier) => (
          <div key={tier.title} className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
            <h3 className="text-lg font-semibold uppercase tracking-[0.3em] text-silver">{tier.title}</h3>
            <div className="mt-4 space-y-3">
              {tier.slots.map((slot) => {
                const assigned = slot.profile?.roblox_username || slot.profile?.discord_username;
                const busy = activeSlotId === slot.id;
                return (
                  <div key={slot.id} className="space-y-2">
                    <CommandSlotCard title={normalizeSlotTitle(slot.slot_title)} assigned={assigned || undefined} filled={Boolean(assigned)} />
                    {isStaff && (
                      <div className="grid gap-2">
                        <input
                          defaultValue={normalizeSlotTitle(slot.slot_title)}
                          onBlur={(event) => {
                            const value = event.target.value.trim();
                            if (value && value !== slot.slot_title) {
                              void updateSlot(slot, { slot_title: value });
                            }
                          }}
                          className="rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-xs text-silver"
                        />
                        <select
                          value={slot.profile_id || ''}
                          onChange={(event) => void updateSlot(slot, { profile_id: event.target.value || null })}
                          disabled={busy}
                          className="rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-xs text-silver"
                        >
                          <option value="">VACANT</option>
                          {profiles.map((profile) => (
                            <option key={profile.id} value={profile.id}>{profile.roblox_username || profile.discord_username || profile.id}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      )}
    </section>
  );
}
