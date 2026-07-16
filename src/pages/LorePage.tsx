import { useEffect, useState } from 'react';
import StatCard from '../components/shared/StatCard';
import TimelineEntry from '../components/shared/TimelineEntry';
import { supabase } from '../lib/supabase';

const timeline = [
  { year: '2021', title: 'Vaspiria Opened', description: 'Vaspiria opened and began building its operational identity and personnel core.' },
  { year: '2026', title: 'Grand Andouran Battery Reopens', description: 'The Grand Andouran Battery opened and Vaspirian returned to the fray.' }
];

type CommandSlotLite = {
  id: string;
  slot_title: string;
  profile?: {
    roblox_username?: string | null;
    discord_username?: string | null;
  } | null;
};

export default function LorePage() {
  const [totalStrength, setTotalStrength] = useState(0);
  const [battlesFought, setBattlesFought] = useState(0);
  const [commendationsIssued, setCommendationsIssued] = useState(0);
  const [commandingOfficer, setCommandingOfficer] = useState('VACANT');
  const [executiveOfficer, setExecutiveOfficer] = useState('VACANT');

  useEffect(() => {
    const load = async () => {
      const [
        { count: rosterCount },
        { count: battlesCount },
        { count: medalsCount },
        { data: slotData }
      ] = await Promise.all([
        supabase.from('roster').select('*', { count: 'exact', head: true }),
        supabase.from('battles').select('*', { count: 'exact', head: true }),
        supabase.from('medals').select('*', { count: 'exact', head: true }),
        supabase
          .from('command_slots')
          .select('id, slot_title, profile:profiles!command_slots_profile_id_fkey(roblox_username, discord_username)')
      ]);

      setTotalStrength(rosterCount || 0);
      setBattlesFought(battlesCount || 0);
      setCommendationsIssued(medalsCount || 0);

      const slots = (slotData || []) as CommandSlotLite[];
      const commandSlot = slots.find((slot) => /commanding officer/i.test(slot.slot_title));
      const executiveSlot = slots.find((slot) => /executive officer/i.test(slot.slot_title));
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
          </div>
        </aside>
      </div>
    </section>
  );
}
