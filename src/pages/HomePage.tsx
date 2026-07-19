import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import LegionCrest from '../components/shared/LegionCrest';
import StatCard from '../components/shared/StatCard';
import { supabase } from '../lib/supabase';

type BattleLite = {
  id: string;
  status: string;
  start_date: string;
};

type ScheduleEventLite = {
  id: string;
  name: string;
  theater: string;
  start_date: string;
};

function parseDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value: string) {
  const parsed = parseDate(value);
  if (!parsed) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(parsed);
}

export default function HomePage() {
  const [activePersonnel, setActivePersonnel] = useState(0);
  const [battlesCompleted, setBattlesCompleted] = useState(0);
  const [upcomingEngagements, setUpcomingEngagements] = useState(0);
  const [upcomingBattles, setUpcomingBattles] = useState<ScheduleEventLite[]>([]);

  useEffect(() => {
    const load = async () => {
      const [{ count: rosterCount }, { data: battleData }, { data: scheduleData }] = await Promise.all([
        supabase.from('roster').select('*', { count: 'exact', head: true }),
        supabase.from('battles').select('id, status, start_date'),
        supabase.from('schedule_events').select('id, name, theater, start_date').order('start_date', { ascending: true })
      ]);

      const battles = (battleData || []) as BattleLite[];
      const now = new Date();
      const completed = battles.length;
      const upcoming = battles.filter((battle) => {
        const status = String(battle.status || '');
        if (/upcoming|pending|planned|scheduled/i.test(status)) return true;
        const parsed = new Date(battle.start_date);
        return !Number.isNaN(parsed.getTime()) && parsed > now;
      }).length;

      const scheduledBattles = ((scheduleData || []) as ScheduleEventLite[])
        .filter((entry) => {
          const parsed = parseDate(entry.start_date);
          return parsed ? parsed > now : false;
        })
        .sort((a, b) => {
          const left = parseDate(a.start_date)?.getTime() || Number.MAX_SAFE_INTEGER;
          const right = parseDate(b.start_date)?.getTime() || Number.MAX_SAFE_INTEGER;
          return left - right;
        });

      setActivePersonnel(rosterCount || 0);
      setBattlesCompleted(completed);
      setUpcomingEngagements(scheduledBattles.length || upcoming);
      setUpcomingBattles(scheduledBattles.slice(0, 5));
    };

    void load();

    const channel = supabase
      .channel('home-live-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'roster' }, () => {
        void load();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battles' }, () => {
        void load();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule_events' }, () => {
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

  const stats = [
    { label: 'Active Personnel', value: activePersonnel },
    { label: 'Battles Completed', value: battlesCompleted },
    { label: 'Upcoming Engagements', value: upcomingEngagements }
  ];

  return (
    <section className="space-y-8">
      <div className="rounded border border-slateBlue/70 bg-[#141a24] p-8 shadow-[0_0_30px_rgba(30,58,95,0.2)]">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded border border-silver/30 bg-slateBlue/30 px-3 py-1 text-[10px] uppercase tracking-[0.35em] text-slate-300">
              <LegionCrest className="h-3.5 w-3.5 object-contain" alt="Legion crest" />
              Grand Andouran Battery
            </div>
            <h1 className="text-4xl font-black uppercase leading-[0.95] tracking-[0.25em] text-silver sm:text-6xl">
              Quicquid<br />Capit
            </h1>
            <p className="mt-4 max-w-xl text-lg text-slate-300">
              The union of Pirkland and Melrose forged into a single artillery formation of imperial discipline and tactical fire.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="/enlist" className="rounded border border-silver/50 bg-silver px-4 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-slateBlue">Enlist Now</a>
              <a href="/login" className="rounded border border-slateBlue/70 px-4 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-silver">Officer Login</a>
            </div>
          </div>
          <div className="flex h-72 w-72 items-center justify-center rounded-full border border-silver/20 bg-[radial-gradient(circle,_rgba(232,236,242,0.18),_transparent_70%)] p-8">
            <div className="flex h-56 w-56 items-center justify-center rounded-full border border-silver/40 bg-slateBlue/20 shadow-[0_0_35px_rgba(232,236,242,0.12)]">
              <LegionCrest className="h-36 w-36 object-contain" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {stats.map((stat) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} />
        ))}
      </div>

      <div className="rounded border border-slateBlue/60 bg-[#0d121b] p-6">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.3em] text-silver">
          <ArrowRight className="h-4 w-4" />
          Upcoming Battles
        </div>
        {upcomingBattles.length === 0 ? (
          <p className="mt-3 text-slate-300">No battles currently scheduled.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {upcomingBattles.map((entry) => (
              <div key={entry.id} className="rounded border border-slateBlue/40 bg-[#141a24] px-3 py-2">
                <div className="text-sm font-semibold text-silver">{entry.name}</div>
                <div className="text-xs text-slate-400">{formatDate(entry.start_date)} • {entry.theater}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
