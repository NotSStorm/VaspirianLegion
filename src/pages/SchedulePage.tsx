import { useEffect, useState } from 'react';
import BattleCard from '../components/shared/BattleCard';
import { getAuthenticatedState } from '../lib/auth';
import { supabase } from '../lib/supabase';

type ScheduleEvent = {
  id: string;
  name: string;
  classification: string;
  status: string;
  theater: string;
  commanding_officer: string;
  personnel_count: number;
  start_date: string;
  threat_level: number;
  notes?: string | null;
};

export default function SchedulePage() {
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [isStaff, setIsStaff] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    classification: 'Public',
    status: 'Pending',
    theater: '',
    commandingOfficer: '',
    personnelCount: 0,
    startDate: '',
    threatLevel: 1,
    notes: ''
  });

  const loadSchedule = async () => {
    setError(null);
    try {
      const { profile } = await getAuthenticatedState();
      setIsStaff(profile?.role === 'admin' || profile?.role === 'officer');

      const { data, error: loadError } = await supabase
        .from('schedule_events')
        .select('*')
        .order('created_at', { ascending: false });

      if (loadError) throw loadError;
      setEvents((data || []) as ScheduleEvent[]);
    } catch (loadErr) {
      setError(loadErr instanceof Error ? loadErr.message : 'Unable to load schedule.');
      setEvents([]);
    }
  };

  useEffect(() => {
    void loadSchedule();
  }, []);

  const createEvent = async () => {
    setError(null);
    try {
      const { error: insertError } = await supabase.from('schedule_events').insert({
        name: form.name,
        classification: form.classification,
        status: form.status,
        theater: form.theater,
        commanding_officer: form.commandingOfficer,
        personnel_count: Number(form.personnelCount) || 0,
        start_date: form.startDate,
        threat_level: Math.max(1, Math.min(5, Number(form.threatLevel) || 1)),
        notes: form.notes || null
      });

      if (insertError) throw insertError;

      setForm({
        name: '',
        classification: 'Public',
        status: 'Pending',
        theater: '',
        commandingOfficer: '',
        personnelCount: 0,
        startDate: '',
        threatLevel: 1,
        notes: ''
      });
      await loadSchedule();
    } catch (createErr) {
      setError(createErr instanceof Error ? createErr.message : 'Unable to create schedule event.');
    }
  };

  return (
    <section className="space-y-6">
      <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
        <div className="text-[10px] uppercase tracking-[0.35em] text-slate-400">Schedule</div>
        <h2 className="mt-2 text-3xl font-semibold uppercase tracking-[0.2em] text-silver">Upcoming Operations</h2>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {events.map((item) => (
          <BattleCard
            key={item.id}
            name={item.name}
            classification={item.classification}
            status={item.status}
            theater={item.theater}
            commandingOfficer={item.commanding_officer}
            personnelCount={item.personnel_count}
            date={item.start_date}
            threatLevel={item.threat_level}
          />
        ))}
      </div>

      {isStaff && (
        <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
          <h3 className="text-lg font-semibold uppercase tracking-[0.3em] text-silver">Add Schedule Event</h3>
          <p className="mt-2 text-sm text-slate-300">Use this format: day/region classification, rally time, CO, and notes/link in the note field.</p>
          <div className="mt-4 grid gap-3">
            <input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="Event title" className="rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver" />
            <div className="grid grid-cols-2 gap-3">
              <input value={form.classification} onChange={(event) => setForm((prev) => ({ ...prev, classification: event.target.value }))} placeholder="Classification" className="rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver" />
              <input value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))} placeholder="Status" className="rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input value={form.theater} onChange={(event) => setForm((prev) => ({ ...prev, theater: event.target.value }))} placeholder="Theater" className="rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver" />
              <input value={form.commandingOfficer} onChange={(event) => setForm((prev) => ({ ...prev, commandingOfficer: event.target.value }))} placeholder="CO" className="rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <input type="number" value={form.personnelCount} onChange={(event) => setForm((prev) => ({ ...prev, personnelCount: Number(event.target.value) }))} placeholder="Personnel" className="rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver" />
              <input value={form.startDate} onChange={(event) => setForm((prev) => ({ ...prev, startDate: event.target.value }))} placeholder="Date / Rally time" className="rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver" />
              <input type="number" min={1} max={5} value={form.threatLevel} onChange={(event) => setForm((prev) => ({ ...prev, threatLevel: Number(event.target.value) }))} placeholder="Threat 1-5" className="rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver" />
            </div>
            <textarea value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} placeholder="Notes / event link" className="min-h-[100px] rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver" />
            <button type="button" onClick={() => void createEvent()} className="rounded border border-silver/50 bg-silver px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slateBlue">Add Schedule Entry</button>
          </div>
        </div>
      )}
    </section>
  );
}
