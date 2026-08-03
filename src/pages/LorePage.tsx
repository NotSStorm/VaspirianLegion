import { useEffect, useMemo, useState } from 'react';
import StatCard from '../components/shared/StatCard';
import TimelineEntry from '../components/shared/TimelineEntry';
import { getAuthenticatedState } from '../lib/auth';
import { supabase } from '../lib/supabase';

const timeline = [
  { year: '2021', title: 'Vaspiria Opened', description: 'Vaspiria opened and began building its operational identity and personnel core.' },
  { year: '2026', title: 'Grand Andouran Battery Reopens', description: 'The Grand Andouran Battery opened and Vaspirian returned to the fray.' }
];

type CommandSlotLite = {
  id: string;
  slot_title: string;
  profile_id?: string | null;
  profile?: {
    roblox_username?: string | null;
    discord_username?: string | null;
  } | null;
};

type ProfileOption = {
  id: string;
  roblox_username?: string | null;
  discord_username?: string | null;
};

function isCommandingOfficerSlot(title: string) {
  return /commanding officer/i.test(title);
}

function isExecutiveOfficerSlot(title: string) {
  return /executive officer/i.test(title);
}

export default function LorePage() {
  const [totalStrength, setTotalStrength] = useState(0);
  const [battlesFought, setBattlesFought] = useState(0);
  const [commendationsIssued, setCommendationsIssued] = useState(0);
  const [commandingOfficer, setCommandingOfficer] = useState('VACANT');
  const [executiveOfficer, setExecutiveOfficer] = useState('VACANT');
  const [commandSlots, setCommandSlots] = useState<CommandSlotLite[]>([]);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [isStaff, setIsStaff] = useState(false);
  const [busySlot, setBusySlot] = useState<string | null>(null);
  const [assignmentMessage, setAssignmentMessage] = useState<string | null>(null);

  const commandingOfficerSlot = useMemo(
    () => commandSlots.find((slot) => isCommandingOfficerSlot(slot.slot_title)) || null,
    [commandSlots]
  );

  const executiveOfficerSlot = useMemo(
    () => commandSlots.find((slot) => isExecutiveOfficerSlot(slot.slot_title)) || null,
    [commandSlots]
  );

  useEffect(() => {
    const load = async () => {
      const [
        { profile: viewerProfile },
        { count: rosterCount },
        { count: battlesCount },
        { count: medalsCount },
        { data: slotData },
        { data: profileData }
      ] = await Promise.all([
        getAuthenticatedState(),
        supabase.from('roster').select('*', { count: 'exact', head: true }),
        supabase.from('battles').select('*', { count: 'exact', head: true }),
        supabase.from('medals').select('*', { count: 'exact', head: true }),
        supabase
          .from('command_slots')
          .select('id, slot_title, profile_id, profile:profiles!command_slots_profile_id_fkey(roblox_username, discord_username)'),
        supabase
          .from('profiles')
          .select('id, roblox_username, discord_username')
          .order('created_at', { ascending: true })
      ]);

      setIsStaff(viewerProfile?.role === 'admin' || viewerProfile?.role === 'officer');

      setTotalStrength(rosterCount || 0);
      setBattlesFought(battlesCount || 0);
      setCommendationsIssued(medalsCount || 0);

      const slots = (slotData || []) as CommandSlotLite[];
      setCommandSlots(slots);
      setProfiles((profileData || []) as ProfileOption[]);
      const commandSlot = slots.find((slot) => isCommandingOfficerSlot(slot.slot_title));
      const executiveSlot = slots.find((slot) => isExecutiveOfficerSlot(slot.slot_title));
      setCommandingOfficer(commandSlot?.profile?.roblox_username || commandSlot?.profile?.discord_username || 'VACANT');
      setExecutiveOfficer(executiveSlot?.profile?.roblox_username || executiveSlot?.profile?.discord_username || 'VACANT');
    };

    void load();

    const channel = supabase
      .channel('lore-live-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'roster' }, () => {
        void load();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battles' }, () => {
        void load();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'medals' }, () => {
        void load();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'command_slots' }, () => {
        void load();
      })
      .subscribe();

    const pollId = window.setInterval(() => {
      void load();
    }, 20000);

    return () => {
      window.clearInterval(pollId);
      void supabase.removeChannel(channel);
    };
  }, []);

  const updateCommandSlot = async (slot: CommandSlotLite | null, profileId: string) => {
    if (!slot) {
      setAssignmentMessage('Required command slot is missing.');
      return;
    }

    setBusySlot(slot.id);
    setAssignmentMessage(null);

    try {
      const { error } = await supabase
        .from('command_slots')
        .update({ profile_id: profileId || null })
        .eq('id', slot.id);

      if (error) {
        throw error;
      }

      setAssignmentMessage('Command staff updated.');

      const assignedProfile = profiles.find((entry) => entry.id === profileId) || null;
      const displayName = assignedProfile?.roblox_username || assignedProfile?.discord_username || 'VACANT';
      if (isCommandingOfficerSlot(slot.slot_title)) {
        setCommandingOfficer(profileId ? displayName : 'VACANT');
      }
      if (isExecutiveOfficerSlot(slot.slot_title)) {
        setExecutiveOfficer(profileId ? displayName : 'VACANT');
      }

      const { data: refreshedSlots } = await supabase
        .from('command_slots')
        .select('id, slot_title, profile_id, profile:profiles!command_slots_profile_id_fkey(roblox_username, discord_username)');

      setCommandSlots((refreshedSlots || []) as CommandSlotLite[]);
    } catch (error) {
      setAssignmentMessage(error instanceof Error ? error.message : 'Unable to update command staff.');
    } finally {
      setBusySlot(null);
    }
  };

  return (
    <section className="space-y-8">
      <div className="rounded border border-slateBlue/70 bg-[#141a24] p-8">
        <div className="text-[10px] uppercase tracking-[0.35em] text-slate-400">Historical Record</div>
        <h2 className="mt-2 text-3xl font-semibold uppercase tracking-[0.2em] text-silver">Grand Andouran Battery</h2>
        <p className="mt-4 max-w-3xl text-slate-300">
          The Grand Andouran Battery was forged from the battle-hardened infantry of Pirkland and the engineering genius of Melrose into a single imperial artillery formation serving both Keisarik corps.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Strength" value={totalStrength} />
        <StatCard label="Battles Fought" value={battlesFought} />
        <StatCard label="Years of Service" value={5} />
        <StatCard label="Commendations Issued" value={commendationsIssued} />
      </div>

      <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
          <h3 className="text-lg font-semibold uppercase tracking-[0.3em] text-silver">Campaign Timeline</h3>
          <div className="mt-6">
            {timeline.map((entry) => (
              <TimelineEntry key={entry.year} year={entry.year} title={entry.title} description={entry.description} />
            ))}
          </div>
        </div>
        <aside className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
          <h3 className="text-lg font-semibold uppercase tracking-[0.3em] text-silver">Command Staff</h3>
          <div className="mt-4 space-y-3 text-sm text-slate-300">
            <div className="rounded border border-slateBlue/60 p-3"><div className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Commanding Officer</div><div className="font-semibold text-silver">{commandingOfficer}</div></div>
            <div className="rounded border border-slateBlue/60 p-3"><div className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Executive Officer</div><div className="font-semibold text-silver">{executiveOfficer}</div></div>
            {isStaff && (
              <div className="space-y-3 rounded border border-slateBlue/60 bg-[#0d121b] p-3">
                <div className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Manage Command Staff</div>
                <label className="block">
                  <div className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Choose CO</div>
                  <select
                    value={commandingOfficerSlot?.profile_id || ''}
                    onChange={(event) => void updateCommandSlot(commandingOfficerSlot, event.target.value)}
                    disabled={busySlot === commandingOfficerSlot?.id}
                    className="mt-2 w-full rounded border border-slateBlue/60 bg-[#141a24] px-3 py-2 text-sm text-silver"
                  >
                    <option value="">VACANT</option>
                    {profiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>{profile.roblox_username || profile.discord_username || profile.id}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <div className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Choose XO</div>
                  <select
                    value={executiveOfficerSlot?.profile_id || ''}
                    onChange={(event) => void updateCommandSlot(executiveOfficerSlot, event.target.value)}
                    disabled={busySlot === executiveOfficerSlot?.id}
                    className="mt-2 w-full rounded border border-slateBlue/60 bg-[#141a24] px-3 py-2 text-sm text-silver"
                  >
                    <option value="">VACANT</option>
                    {profiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>{profile.roblox_username || profile.discord_username || profile.id}</option>
                    ))}
                  </select>
                </label>
                {assignmentMessage && <p className="text-xs text-slate-300">{assignmentMessage}</p>}
              </div>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
