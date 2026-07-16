import { useEffect, useState } from 'react';
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

const CLASSIFICATION_OPTIONS = ['Infantry', 'Arty', 'Skirms', 'Cav'] as const;

function parseEventDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatEventDate(value: string) {
  const parsed = parseEventDate(value);
  if (!parsed) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(parsed);
}

function formatEventTime(value: string) {
  const parsed = parseEventDate(value);
  if (!parsed) {
    return { time: 'N/A', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone };
  }

  return {
    time: new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit'
    }).format(parsed),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  };
}

export default function SchedulePage() {
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [isStaff, setIsStaff] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    classification: 'Infantry',
    commandingOfficer: '',
    personnelCount: 0,
    startDate: '',
    rallyTime: '',
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
        .order('start_date', { ascending: true });

      if (loadError) throw loadError;
      const now = new Date();
      const upcomingOnly = ((data || []) as ScheduleEvent[]).filter((event) => {
        const parsed = parseEventDate(event.start_date);
        return !parsed || parsed >= now;
      });
      setEvents(upcomingOnly);
    } catch (loadErr) {
      setError(loadErr instanceof Error ? loadErr.message : 'Unable to load schedule.');
      setEvents([]);
    }
  };

  useEffect(() => {
    void loadSchedule();
  }, []);

  const deleteEvent = async (id: string) => {
    setError(null);
    try {
      const { error: deleteError } = await supabase.from('schedule_events').delete().eq('id', id);
      if (deleteError) throw deleteError;
      await loadSchedule();
    } catch (deleteErr) {
      setError(deleteErr instanceof Error ? deleteErr.message : 'Unable to delete schedule event.');
    }
  };

  const createEvent = async () => {
    setError(null);
    try {
      const combinedDateTime = form.startDate && form.rallyTime
        ? new Date(`${form.startDate}T${form.rallyTime}`)
        : null;

      if (!combinedDateTime || Number.isNaN(combinedDateTime.getTime())) {
        setError('Please provide a valid date and rally time.');
        return;
      }

      const { error: insertError } = await supabase.from('schedule_events').insert({
        name: form.name,
        classification: form.classification,
        status: 'Scheduled',
        theater: 'N/A',
        commanding_officer: form.commandingOfficer,
        personnel_count: Number(form.personnelCount) || 0,
        start_date: combinedDateTime.toISOString(),
        threat_level: 0,
        notes: form.notes || null
      });

      if (insertError) throw insertError;

      setForm({
        name: '',
        classification: 'Infantry',
        commandingOfficer: '',
        personnelCount: 0,
        startDate: '',
        rallyTime: '',
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
        {events.map((item) => {
          const timeInfo = formatEventTime(item.start_date);
          return (
            <div key={item.id} className="rounded border border-slateBlue/60 bg-[#141a24] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-lg font-semibold text-silver">{item.name}</div>
                <div className="flex items-center gap-2">
                  <span className="rounded border border-slateBlue/60 px-2 py-1 text-xs uppercase tracking-[0.3em] text-slate-300">{item.classification}</span>
                  {isStaff && (
                    <button
                      type="button"
                      onClick={() => setPendingDeleteId(item.id)}
                      className="rounded border border-red-500/60 px-2 py-1 text-xs uppercase tracking-[0.3em] text-red-300"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-4 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
                <div><span className="text-slate-400">CO</span><div className="font-semibold text-silver">{item.commanding_officer}</div></div>
                <div><span className="text-slate-400">Cap</span><div className="font-semibold text-silver">{item.personnel_count}</div></div>
                <div><span className="text-slate-400">Date</span><div className="font-semibold text-silver">{formatEventDate(item.start_date)}</div></div>
                <div><span className="text-slate-400">Rally Time</span><div className="font-semibold text-silver">{timeInfo.time} <span className="text-slate-400">({timeInfo.timezone})</span></div></div>
              </div>
              {item.notes && <div className="mt-4 text-sm text-slate-300">{item.notes}</div>}
            </div>
          );
        })}
      </div>

      {isStaff && (
        <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
          <h3 className="text-lg font-semibold uppercase tracking-[0.3em] text-silver">Add Schedule Event</h3>
          <p className="mt-2 text-sm text-slate-300">Set the event type, rally date, rally time, CO, and any notes or event link.</p>
          <div className="mt-4 grid gap-3">
            <label className="text-xs text-slate-400">Event Title
              <input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="Event title" className="mt-1 w-full rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-slate-400">Classification
                <select value={form.classification} onChange={(event) => setForm((prev) => ({ ...prev, classification: event.target.value }))} className="mt-1 w-full rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver">
                  {CLASSIFICATION_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label className="text-xs text-slate-400">CO
                <input value={form.commandingOfficer} onChange={(event) => setForm((prev) => ({ ...prev, commandingOfficer: event.target.value }))} placeholder="CO" className="mt-1 w-full rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver" />
              </label>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <label className="text-xs text-slate-400">Cap
                <input type="number" value={form.personnelCount} onChange={(event) => setForm((prev) => ({ ...prev, personnelCount: Number(event.target.value) }))} placeholder="Personnel" className="mt-1 w-full rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver" />
              </label>
              <label className="text-xs text-slate-400">Date
                <input type="date" value={form.startDate} onChange={(event) => setForm((prev) => ({ ...prev, startDate: event.target.value }))} className="mt-1 w-full rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver" />
              </label>
              <label className="text-xs text-slate-400">Rally Time
                <input type="time" value={form.rallyTime} onChange={(event) => setForm((prev) => ({ ...prev, rallyTime: event.target.value }))} className="mt-1 w-full rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver" />
              </label>
            </div>
            <label className="text-xs text-slate-400">Notes / Event Link
              <textarea value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} placeholder="Notes / event link" className="mt-1 min-h-[100px] w-full rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver" />
            </label>
            <button type="button" onClick={() => void createEvent()} className="rounded border border-silver/50 bg-silver px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slateBlue">Add Schedule Entry</button>
          </div>
        </div>
      )}

      {pendingDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded border border-slateBlue/70 bg-[#141a24] p-6">
            <h4 className="text-lg font-semibold uppercase tracking-[0.2em] text-silver">Delete Schedule Event</h4>
            <p className="mt-3 text-sm text-slate-300">This schedule event will be permanently removed. Continue?</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDeleteId(null)}
                className="rounded border border-slateBlue/70 px-3 py-2 text-xs uppercase tracking-[0.3em] text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const targetId = pendingDeleteId;
                  setPendingDeleteId(null);
                  if (targetId) {
                    await deleteEvent(targetId);
                  }
                }}
                className="rounded border border-red-500/60 bg-red-500/10 px-3 py-2 text-xs uppercase tracking-[0.3em] text-red-300"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
