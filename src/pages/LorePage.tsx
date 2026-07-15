import StatCard from '../components/shared/StatCard';
import TimelineEntry from '../components/shared/TimelineEntry';

const timeline = [
  { year: '1798', title: 'The Founding Ledger', description: 'Pirkland and Melrose infantry and engineers are consolidated into a single artillery command under the imperial standard.' },
  { year: '1803', title: 'The First Battery', description: 'The first unified gun crews and sappers begin field exercises across the border theaters.' },
  { year: '1811', title: 'Campaigns of the Iron March', description: 'The unit earns distinction in long-range bombardment and rapid engineering action.' }
];

export default function LorePage() {
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
        <StatCard label="Total Strength" value="128" />
        <StatCard label="Battles Fought" value="31" />
        <StatCard label="Years of Service" value="27" />
        <StatCard label="Commendations Issued" value="14" />
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
            <div className="rounded border border-slateBlue/60 p-3"><div className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Commanding Officer</div><div className="font-semibold text-silver">S-Lt. Jolyne Valeryon</div></div>
            <div className="rounded border border-slateBlue/60 p-3"><div className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Executive Officer</div><div className="font-semibold text-silver">S-Lt. Lurac_Case</div></div>
          </div>
        </aside>
      </div>
    </section>
  );
}
