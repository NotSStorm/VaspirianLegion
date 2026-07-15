import BattleCard from '../components/shared/BattleCard';

const schedule = [
  { name: 'Campaign Exercise: Black Riband', classification: 'Officer Only', status: 'Pending', theater: 'Vaspirian Highlands', commandingOfficer: 'S-Lt. Lurac_Case', personnelCount: 24, date: '22 Aug 1812', threatLevel: 2 },
  { name: 'Night Artillery Drill', classification: 'Public', status: 'Pending', theater: 'Anders Basin', commandingOfficer: 'SSgt. Jorge Jørgensen', personnelCount: 14, date: 'TBD', threatLevel: 2 }
];

export default function SchedulePage() {
  return (
    <section className="space-y-6">
      <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
        <div className="text-[10px] uppercase tracking-[0.35em] text-slate-400">Schedule</div>
        <h2 className="mt-2 text-3xl font-semibold uppercase tracking-[0.2em] text-silver">Upcoming Operations</h2>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {schedule.map((item) => (
          <BattleCard key={item.name} {...item} />
        ))}
      </div>
    </section>
  );
}
