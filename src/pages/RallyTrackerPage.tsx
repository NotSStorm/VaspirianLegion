import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

type RallyEvent = {
  id: string;
  title: string;
  occurred_on: string;
  company: string;
  region?: string | null;
};

type Attendance = {
  event_id: string;
  present: boolean;
  assigned_role?: string | null;
  profile?: {
    roblox_username?: string | null;
    discord_username?: string | null;
  } | null;
};

export default function RallyTrackerPage() {
  const [events, setEvents] = useState<RallyEvent[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);

  useEffect(() => {
    const load = async () => {
      const [{ data: eventData }, { data: attendanceData }] = await Promise.all([
        supabase.from('rally_events').select('id, title, occurred_on, company, region').order('occurred_on', { ascending: false }),
        supabase.from('rally_attendance').select('event_id, present, assigned_role, profile:profiles!rally_attendance_profile_id_fkey(roblox_username, discord_username)')
      ]);

      setEvents((eventData || []) as RallyEvent[]);
      setAttendance((attendanceData || []) as Attendance[]);
    };
    void load();
  }, []);

  const grouped = useMemo(() => {
    return events.map((event) => ({
      event,
      entries: attendance.filter((entry) => entry.event_id === event.id)
    }));
  }, [events, attendance]);

  return (
    <section className="space-y-6">
      <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
        <div className="text-[10px] uppercase tracking-[0.35em] text-slate-400">Operations Attendance</div>
        <h2 className="mt-2 text-3xl font-semibold uppercase tracking-[0.2em] text-silver">Rally Tracker</h2>
      </div>

      <div className="space-y-4">
        {grouped.length === 0 ? (
          <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6 text-sm text-slate-400">No rally events tracked yet.</div>
        ) : grouped.map(({ event, entries }) => (
          <div key={event.id} className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-lg font-semibold text-silver">{event.title}</div>
              <div className="text-sm text-slate-300">{event.company} | {event.occurred_on}</div>
            </div>
            <div className="mt-3 text-sm text-slate-400">Region: {event.region || 'N/A'}</div>
            <div className="mt-4 space-y-2">
              {entries.length === 0 ? (
                <p className="text-sm text-slate-400">No attendance entries recorded.</p>
              ) : entries.map((entry, index) => (
                <div key={`${event.id}-${index}`} className="flex items-center justify-between rounded border border-slateBlue/60 px-3 py-2 text-sm">
                  <div className="text-slate-300">{entry.profile?.roblox_username || entry.profile?.discord_username || 'Unknown'}</div>
                  <div className="text-silver">{entry.present ? 'Present' : 'Absent'}{entry.assigned_role ? ` | ${entry.assigned_role}` : ''}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}